import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { catalogBooks, getCatalogBook } from "../lib/catalog";

describe("Book catalog pages", () => {
  test("gives every seeded book a unique stable slug and cover treatment", () => {
    assert.equal(catalogBooks.length, 8);
    assert.equal(new Set(catalogBooks.map((book) => book.slug)).size, catalogBooks.length);
    assert.ok(catalogBooks.every((book) => book.coverClass && book.coverMark && book.accent));
  });

  test("resolves a book through its referenceable page path", () => {
    const path = "/books/the-night-cartographer";
    const book = getCatalogBook(path.replace("/books/", ""));
    assert.equal(book?.title, "The Night Cartographer");
    assert.equal(book?.genre, "fantasy");
  });
});
