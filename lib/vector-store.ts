import * as lancedb from "@lancedb/lancedb";
import { isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import type { BooklyDatabase } from "./database";

const KNOWLEDGE_TABLE = "bookly_knowledge";
const inMemoryPaths = new WeakMap<BooklyDatabase, string>();
let inMemoryPathCounter = 0;

export type KnowledgeDocument = {
  id: string;
  documentType: "books" | "policy";
  slug: string;
  title: string;
  section: string;
  content: string;
  description: string;
  source: string;
  author?: string;
  bookType?: string;
  genre?: string;
  publicationYear?: number;
  pages?: number;
  isbn?: string;
  formats?: string[];
  price?: string;
  audience?: string;
  themes?: string[];
};

export type KnowledgeFilters = {
  filter: "books" | "policy";
  author?: string;
  bookType?: string;
  genre?: string;
};

export type KnowledgeMatch = {
  document_type: "books" | "policy";
  slug: string;
  title: string;
  section: string;
  content: string;
  description: string;
  source: string;
  author: string;
  book_type: string;
  genre: string;
  publication_year: number;
  pages: number;
  isbn: string;
  formats: string;
  price: string;
  audience: string;
  themes: string;
  _distance: number;
};

function normalizedMetadata(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function vectorDatabasePath(db: BooklyDatabase) {
  const configured = process.env.BOOKLY_VECTOR_DB_PATH;
  if (configured) {
    return isAbsolute(configured)
      ? configured
      : join(/* turbopackIgnore: true */ process.cwd(), configured);
  }
  if (db.name === ":memory:") {
    let path = inMemoryPaths.get(db);
    if (!path) {
      inMemoryPathCounter += 1;
      path = join(tmpdir(), `bookly-lancedb-${process.pid}-${inMemoryPathCounter}`);
      inMemoryPaths.set(db, path);
    }
    return path;
  }
  return join(process.cwd(), "data", "bookly-lancedb");
}

export async function knowledgeBaseIsCurrent(
  db: BooklyDatabase,
  contentHash: string,
  expectedDocuments: number,
) {
  const connection = await lancedb.connect(vectorDatabasePath(db));
  try {
    if (!(await connection.tableNames()).includes(KNOWLEDGE_TABLE)) return false;
    const table = await connection.openTable(KNOWLEDGE_TABLE);
    try {
      const matchingRows = await table.countRows(`content_hash = ${sqlString(contentHash)}`);
      return matchingRows === expectedDocuments;
    } finally {
      table.close();
    }
  } finally {
    connection.close();
  }
}

export async function replaceKnowledgeBase(
  db: BooklyDatabase,
  documents: KnowledgeDocument[],
  vectors: Float32Array[],
  contentHash: string,
) {
  if (documents.length === 0 || documents.length !== vectors.length) {
    throw new Error("Knowledge documents and embeddings must be non-empty and have matching lengths.");
  }
  const records = documents.map((document, index) => ({
    id: document.id,
    document_type: document.documentType,
    slug: document.slug,
    title: document.title,
    section: document.section,
    content: document.content,
    description: document.description,
    source: document.source,
    author: document.author ?? "",
    author_key: normalizedMetadata(document.author ?? ""),
    book_type: document.bookType ?? "",
    book_type_key: normalizedMetadata(document.bookType ?? ""),
    genre: document.genre ?? "",
    genre_key: normalizedMetadata(document.genre ?? ""),
    publication_year: document.publicationYear ?? 0,
    pages: document.pages ?? 0,
    isbn: document.isbn ?? "",
    formats: (document.formats ?? []).join(", "),
    price: document.price ?? "",
    audience: document.audience ?? "",
    themes: (document.themes ?? []).join(", "),
    content_hash: contentHash,
    vector: vectors[index],
  }));

  const connection = await lancedb.connect(vectorDatabasePath(db));
  try {
    const table = await connection.createTable(KNOWLEDGE_TABLE, records, { mode: "overwrite" });
    table.close();
  } finally {
    connection.close();
  }
}

export async function knowledgeBaseCounts(db: BooklyDatabase) {
  const connection = await lancedb.connect(vectorDatabasePath(db));
  try {
    const table = await connection.openTable(KNOWLEDGE_TABLE);
    try {
      const [documents, policyChunks, books] = await Promise.all([
        table.countRows(),
        table.countRows("document_type = 'policy'"),
        table.countRows("document_type = 'books'"),
      ]);
      return { documents, policyChunks, books };
    } finally {
      table.close();
    }
  } finally {
    connection.close();
  }
}

export async function searchKnowledgeBase(
  db: BooklyDatabase,
  vector: Float32Array,
  filters: KnowledgeFilters,
  limit = 3,
) {
  const predicates = [`document_type = ${sqlString(filters.filter)}`];
  if (filters.filter === "books") {
    if (filters.author) {
      predicates.push(`author_key = ${sqlString(normalizedMetadata(filters.author))}`);
    }
    if (filters.bookType) {
      predicates.push(`book_type_key = ${sqlString(normalizedMetadata(filters.bookType))}`);
    }
    if (filters.genre) {
      predicates.push(`genre_key = ${sqlString(normalizedMetadata(filters.genre))}`);
    }
  }

  const connection = await lancedb.connect(vectorDatabasePath(db));
  try {
    const table = await connection.openTable(KNOWLEDGE_TABLE);
    try {
      // LanceDB applies `where` as a prefilter by default, so unrelated document
      // types and book metadata never enter nearest-neighbor ranking.
      return await table
        .vectorSearch(vector)
        .where(predicates.join(" AND "))
        .select([
          "document_type",
          "slug",
          "title",
          "section",
          "content",
          "description",
          "source",
          "author",
          "book_type",
          "genre",
          "publication_year",
          "pages",
          "isbn",
          "formats",
          "price",
          "audience",
          "themes",
          "_distance",
        ])
        .limit(limit)
        .toArray() as KnowledgeMatch[];
    } finally {
      table.close();
    }
  } finally {
    connection.close();
  }
}
