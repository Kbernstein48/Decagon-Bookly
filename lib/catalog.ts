import bookData from "../knowledge/books.json";

export type CatalogBook = (typeof bookData)[number] & {
  coverClass: string;
  coverMark: string;
  accent: string;
};

const presentation: Record<string, Pick<CatalogBook, "coverClass" | "coverMark" | "accent">> = {
  "the-sea-between-us": {
    coverClass: "cover-sea",
    coverMark: "THE SEA\nBETWEEN US",
    accent: "Coastal literary fiction",
  },
  "midnight-at-the-paper-moon": {
    coverClass: "cover-midnight",
    coverMark: "Midnight at the\nPaper Moon",
    accent: "A historical mystery",
  },
  "the-orchard-book": {
    coverClass: "cover-orchard",
    coverMark: "THE\nORCHARD\nBOOK",
    accent: "A practical growing guide",
  },
  "atlas-of-small-wonders": {
    coverClass: "cover-atlas",
    coverMark: "ATLAS\nof small\nwonders",
    accent: "Science hiding in plain sight",
  },
  "a-glass-horizon": {
    coverClass: "cover-glass",
    coverMark: "A GLASS\nHORIZON",
    accent: "Climate science fiction",
  },
  "salt-letters": {
    coverClass: "cover-salt",
    coverMark: "SALT\nLETTERS",
    accent: "A novel of friendship and memory",
  },
  "the-night-cartographer": {
    coverClass: "cover-cartographer",
    coverMark: "THE NIGHT\nCARTOGRAPHER",
    accent: "A city drawn after dark",
  },
  "small-weather": {
    coverClass: "cover-weather",
    coverMark: "SMALL\nWEATHER",
    accent: "Essays on the climate next door",
  },
};

export const catalogBooks: CatalogBook[] = bookData.map((book) => ({
  ...book,
  ...presentation[book.slug],
}));

export function getCatalogBook(slug: string) {
  return catalogBooks.find((book) => book.slug === slug);
}

export function relatedBooksFor(book: CatalogBook, limit = 3) {
  return catalogBooks
    .filter((candidate) => candidate.slug !== book.slug)
    .sort((left, right) => {
      const leftScore = Number(left.author === book.author) * 2 + Number(left.genre === book.genre);
      const rightScore = Number(right.author === book.author) * 2 + Number(right.genre === book.genre);
      return rightScore - leftScore;
    })
    .slice(0, limit);
}
