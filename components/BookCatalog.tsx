"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { BookCard } from "@/components/BookCard";
import type { CatalogBook } from "@/lib/catalog";

export function BookCatalog({ books }: { books: CatalogBook[] }) {
  const [query, setQuery] = useState("");
  const [bookType, setBookType] = useState("all");
  const [genre, setGenre] = useState("all");
  const genres = useMemo(() => [...new Set(books.map((book) => book.genre))].sort(), [books]);

  const visibleBooks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
    return books.filter((book) => {
      const matchesQuery = !normalizedQuery || [
        book.title,
        book.author,
        book.genre,
        book.description,
        ...book.themes,
      ].join(" ").toLocaleLowerCase("en-US").includes(normalizedQuery);
      return matchesQuery &&
        (bookType === "all" || book.book_type === bookType) &&
        (genre === "all" || book.genre === genre);
    });
  }, [bookType, books, genre, query]);

  return (
    <section className="catalog-section" id="catalog-search" aria-labelledby="catalog-heading">
      <div className="catalog-toolbar">
        <div className="catalog-search-field">
          <Search size={18} aria-hidden="true" />
          <label className="sr-only" htmlFor="book-search">Search the catalog</label>
          <input
            id="book-search"
            type="search"
            placeholder="Search by title, author, or theme"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="catalog-filters" aria-label="Book filters">
          <SlidersHorizontal size={17} aria-hidden="true" />
          <label>
            <span className="sr-only">Book type</span>
            <select value={bookType} onChange={(event) => setBookType(event.target.value)}>
              <option value="all">All book types</option>
              <option value="fiction">Fiction</option>
              <option value="nonfiction">Nonfiction</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Genre</span>
            <select value={genre} onChange={(event) => setGenre(event.target.value)}>
              <option value="all">All genres</option>
              {genres.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="catalog-result-heading">
        <div>
          <p className="eyebrow">The complete collection</p>
          <h2 id="catalog-heading">{visibleBooks.length === books.length ? "All books" : "Your shelf"}</h2>
        </div>
        <p aria-live="polite">{visibleBooks.length} {visibleBooks.length === 1 ? "title" : "titles"}</p>
      </div>

      {visibleBooks.length > 0 ? (
        <div className="catalog-grid">
          {visibleBooks.map((book) => <BookCard book={book} key={book.slug} />)}
        </div>
      ) : (
        <div className="catalog-empty">
          <span>No matches yet</span>
          <h3>Try a broader search.</h3>
          <p>Search another title, author, theme, or reset one of the filters above.</p>
          <button onClick={() => { setQuery(""); setBookType("all"); setGenre("all"); }}>Show all books</button>
        </div>
      )}
    </section>
  );
}
