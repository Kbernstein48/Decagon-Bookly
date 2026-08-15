import type { BooklyDatabase } from "./database";
import { embedTexts } from "./embeddings";
import {
  knowledgeBaseIsCurrent,
  replaceKnowledgeBase,
  type KnowledgeDocument,
} from "./vector-store";
import books from "../knowledge/books.json";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const NOW = "2026-08-13T12:00:00.000Z";

const policyFiles = [
  "shipping.md",
  "returns-and-refunds.md",
  "accounts-and-passwords.md",
  "orders.md",
];

type BookRecord = {
  slug: string;
  title: string;
  author: string;
  book_type: string;
  genre: string;
  publication_year: number;
  pages: number;
  isbn: string;
  formats: string[];
  price: string;
  audience: string;
  themes: string[];
  description: string;
};

function catalogPriceCents(book: BookRecord, format: string) {
  const base = Math.round(Number(book.price.replace(/[^0-9.]/g, "")) * 100);
  if (format === "ebook") return Math.max(799, base - 700);
  if (format === "audiobook") return base + 500;
  return base;
}

function catalogSku(book: BookRecord, format: string) {
  return `BKL-${book.slug.toUpperCase()}-${format.toUpperCase()}`;
}

function parsePolicyFile(filename: string): KnowledgeDocument[] {
  const source = `knowledge/${filename}`;
  const markdown = readFileSync(join(process.cwd(), source), "utf8");
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? filename;
  const chunks = markdown.split(/^##\s+/m).slice(1);
  return chunks.map((chunk) => {
    const [heading, ...contentLines] = chunk.split("\n");
    const section = heading.trim();
    return {
      id: `policy:${filename.replace(/\.md$/, "")}:${section}`,
      documentType: "policy" as const,
      slug: filename.replace(/\.md$/, ""),
      title,
      section,
      content: contentLines.join("\n").trim(),
      description: "",
      source,
    };
  });
}

function bookDocuments(): KnowledgeDocument[] {
  return (books as BookRecord[]).map((book) => ({
    id: `book:${book.slug}`,
    documentType: "books",
    slug: book.slug,
    title: book.title,
    section: "Catalog details",
    content: [
      `${book.title} by ${book.author}`,
      `Book type: ${book.book_type}. Genre: ${book.genre}. Audience: ${book.audience}.`,
      `Published ${book.publication_year}; ${book.pages} pages; ISBN ${book.isbn}.`,
      `Formats: ${book.formats.join(", ")}. Price: ${book.price}.`,
      `Themes: ${book.themes.join(", ")}.`,
      book.description,
    ].join("\n"),
    description: book.description,
    source: "knowledge/books.json",
    author: book.author,
    bookType: book.book_type,
    genre: book.genre,
    publicationYear: book.publication_year,
    pages: book.pages,
    isbn: book.isbn,
    formats: book.formats,
    price: book.price,
    audience: book.audience,
    themes: book.themes,
  }));
}

function seedCommerceData(db: BooklyDatabase) {
  const upsertCatalogItem = db.prepare(`
    INSERT INTO catalog_items (
      sku, book_id, title, author, format, price_cents, inventory_quantity, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(sku) DO UPDATE SET
      book_id = excluded.book_id,
      title = excluded.title,
      author = excluded.author,
      format = excluded.format,
      price_cents = excluded.price_cents,
      inventory_quantity = excluded.inventory_quantity,
      active = 1
  `);
  const insertCustomer = db.prepare(`
    INSERT OR IGNORE INTO customers (id, email, first_name, last_name, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertPaymentMethod = db.prepare(`
    INSERT OR IGNORE INTO customer_payment_methods (
      id, customer_id, provider_token, brand, last4, expiry_month,
      expiry_year, cardholder_name, billing_address1, billing_address2,
      billing_city, billing_state, billing_postal_code, is_default, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  const insertOrder = db.prepare(`
    INSERT OR IGNORE INTO orders (
      id, customer_id, status, placed_at, shipped_at, delivered_at,
      estimated_delivery, carrier, tracking_number, subtotal_cents,
      shipping_cents, tax_cents, total_cents, currency, shipping_city,
      shipping_state, shipping_address1, shipping_address2,
      shipping_postal_code, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?)
  `);
  const insertLine = db.prepare(`
    INSERT OR IGNORE INTO order_lines (
      id, order_id, sku, title, author, product_type, quantity,
      refunded_quantity, unit_price_cents, fulfillment_status,
      refundable_until, is_final_sale
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `);
  const insertShipmentEvent = db.prepare(`
    INSERT OR IGNORE INTO shipment_events (
      id, order_id, occurred_at, status_code, description, location
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertSeedRows = () => {
    for (const book of books as BookRecord[]) {
      for (const format of book.formats) {
        const isBackorderedDemo = book.slug === "the-night-cartographer" && format === "audiobook";
        const inventory = isBackorderedDemo ? 0 : (format === "ebook" || format === "audiobook" ? 9999 : 12);
        upsertCatalogItem.run(
          catalogSku(book, format),
          book.slug,
          book.title,
          book.author,
          format,
          catalogPriceCents(book, format),
          inventory,
        );
      }
    }

    insertCustomer.run(1, "maya.chen@example.com", "Maya", "Chen", "2025-11-02T09:10:00.000Z");
    insertCustomer.run(2, "theo.rivera@example.com", "Theo", "Rivera", "2026-03-14T17:45:00.000Z");
    insertPaymentMethod.run(
      "pm_maya_visa", 1, "pm_demo_maya_visa", "Visa", "4242", 12, 2029,
      "Maya Chen", "1421 E Camelback Rd", "Apt 3", "Phoenix", "AZ", "85014", NOW,
    );
    insertPaymentMethod.run(
      "pm_theo_visa", 2, "pm_demo_theo_visa", "Visa", "4242", 12, 2029,
      "Theo Rivera", "901 Congress Ave", null, "Austin", "TX", "78701", NOW,
    );

    insertOrder.run(
      "1234", 1, "in_transit", "2026-08-08T18:24:00.000Z",
      "2026-08-10T14:05:00.000Z", null, "2026-08-16",
      "UPS", "1ZB00KLY1234567890", 4298, 0, 344, 4642,
      "Phoenix", "AZ", "1421 E Camelback Rd", null, "85014", NOW,
    );
    insertLine.run(1001, "1234", "BK-SEA-104", "The Sea Between Us", "Mara Voss", "physical", 1, 2499, "shipped", "2026-09-15", 0);
    insertLine.run(1002, "1234", "BK-MID-228", "Midnight at the Paper Moon", "Theo Vale", "physical", 1, 1799, "shipped", "2026-09-15", 0);
    insertShipmentEvent.run(9001, "1234", "2026-08-10T14:05:00.000Z", "label_created", "Shipping label created", "Phoenix, AZ");
    insertShipmentEvent.run(9002, "1234", "2026-08-10T19:42:00.000Z", "origin_scan", "Package received by UPS", "Phoenix, AZ");
    insertShipmentEvent.run(9003, "1234", "2026-08-10T23:18:00.000Z", "departed_facility", "Departed UPS facility", "Phoenix, AZ");

    insertOrder.run(
      "5678", 1, "delivered", "2026-07-29T16:18:00.000Z",
      "2026-07-30T13:32:00.000Z", "2026-08-04T20:11:00.000Z", "2026-08-04",
      "USPS", "9400111899560000123456", 5597, 0, 448, 6045,
      "Phoenix", "AZ", "1421 E Camelback Rd", "Apt 3", "85014", NOW,
    );
    insertLine.run(2001, "5678", "BK-ORB-411", "The Orchard Book", "Nina Callow", "physical", 1, 2999, "delivered", "2026-09-03", 0);
    insertLine.run(2002, "5678", "BK-ATL-090", "Atlas of Small Wonders", "June Bell", "physical", 2, 1299, "delivered", "2026-09-03", 0);
    insertShipmentEvent.run(9101, "5678", "2026-07-30T13:32:00.000Z", "origin_scan", "Package received by USPS", "Phoenix, AZ");
    insertShipmentEvent.run(9102, "5678", "2026-08-01T05:26:00.000Z", "in_transit", "Moving through the USPS network", "Albuquerque, NM");
    insertShipmentEvent.run(9103, "5678", "2026-08-04T13:08:00.000Z", "out_for_delivery", "Out for delivery", "Phoenix, AZ");
    insertShipmentEvent.run(9104, "5678", "2026-08-04T20:11:00.000Z", "delivered", "Delivered at front porch", "Phoenix, AZ");

    insertOrder.run(
      "2468", 2, "processing", "2026-08-13T08:03:00.000Z",
      null, null, "2026-08-20", null, null, 1899, 499, 192, 2590,
      "Austin", "TX", "901 Congress Ave", null, "78701", NOW,
    );
    insertLine.run(3001, "2468", "BK-GLS-512", "A Glass Horizon", "Amari West", "physical", 1, 1899, "processing", null, 0);
  };

  if (db.inTransaction) insertSeedRows();
  else db.transaction(insertSeedRows)();
}

async function seedKnowledgeBase(db: BooklyDatabase) {
  const policyDocuments = policyFiles.flatMap(parsePolicyFile);
  const books = bookDocuments();
  const documents = [...policyDocuments, ...books];
  const contentHash = createHash("sha256")
    .update(JSON.stringify(documents))
    .digest("hex");
  const existingHash = db.prepare("SELECT value FROM app_settings WHERE key = 'knowledge_content_hash'").get() as { value: string } | undefined;
  const existingProvider = db.prepare("SELECT value FROM app_settings WHERE key = 'embedding_provider'").get() as { value: string } | undefined;
  const summary = {
    documents: documents.length,
    policyChunks: policyDocuments.length,
    books: books.length,
    embeddingProvider: existingProvider?.value,
  };
  if (
    existingHash?.value === contentHash &&
    existingProvider?.value &&
    await knowledgeBaseIsCurrent(db, contentHash, documents.length)
  ) {
    return summary;
  }

  const embeddingResult = await embedTexts(
    documents.map((document) => document.content),
    existingProvider?.value,
  );
  await replaceKnowledgeBase(db, documents, embeddingResult.vectors, contentHash);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO app_settings (key, value) VALUES ('embedding_provider', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(embeddingResult.provider);
    db.prepare(`
      INSERT INTO app_settings (key, value) VALUES ('knowledge_content_hash', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(contentHash);
  })();

  return { ...summary, embeddingProvider: embeddingResult.provider };
}

export async function seedDatabase(db: BooklyDatabase) {
  seedCommerceData(db);
  await seedKnowledgeBase(db);
  db.pragma("optimize");
}

export async function resetDatabaseToDemoBaseline(db: BooklyDatabase) {
  // Ensure the read-only knowledge base exists before the final reset transaction,
  // so no asynchronous work can reintroduce conversation state afterward.
  const knowledge = await seedKnowledgeBase(db);

  db.transaction(() => {
    db.exec(`
      DELETE FROM return_items;
      DELETE FROM return_requests;
      DELETE FROM replacement_lines;
      DELETE FROM replacement_orders;
      DELETE FROM order_action_quotes;
      DELETE FROM payments;
      DELETE FROM checkout_sessions;
      DELETE FROM cart_items;
      DELETE FROM carts;
      DELETE FROM stock_alerts;
      DELETE FROM wishlists;
      DELETE FROM support_cases;
      DELETE FROM refund_lines;
      DELETE FROM refunds;
      DELETE FROM refund_quotes;
      DELETE FROM shipping_investigation_quotes;
      DELETE FROM shipping_investigations;
      DELETE FROM shipment_events;
      DELETE FROM order_lines;
      DELETE FROM orders;
      DELETE FROM customer_payment_methods;
      DELETE FROM customers;
      DELETE FROM catalog_items;
      DELETE FROM conversation_messages;
      DELETE FROM tool_runs;
      DELETE FROM sqlite_sequence WHERE name IN ('refund_lines', 'replacement_lines', 'return_items');
    `);
    seedCommerceData(db);
  })();

  db.pragma("wal_checkpoint(PASSIVE)");
  db.pragma("optimize");

  const commerce = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM order_lines) AS order_lines,
      (SELECT COUNT(*) FROM refunds) AS refunds,
      (SELECT COUNT(*) FROM payments) AS payments,
      (SELECT COUNT(*) FROM carts) AS carts,
      (SELECT COUNT(*) FROM replacement_orders) AS replacements,
      (SELECT COUNT(*) FROM return_requests) AS returns,
      (SELECT COUNT(*) FROM support_cases) AS support_cases,
      (SELECT COUNT(*) FROM catalog_items) AS catalog_items,
      (SELECT COUNT(*) FROM shipping_investigations) AS shipping_investigations,
      (SELECT COUNT(*) FROM shipment_events) AS shipment_events,
      (SELECT COUNT(*) FROM conversation_messages) AS messages,
      (SELECT COUNT(*) FROM tool_runs) AS tool_runs
  `).get();
  return {
    ...(commerce as Record<string, number>),
    knowledge_documents: knowledge.documents,
    policy_chunks: knowledge.policyChunks,
    book_documents: knowledge.books,
  };
}
