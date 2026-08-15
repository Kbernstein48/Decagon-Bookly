import Link from "next/link";
import type { CatalogBook } from "@/lib/catalog";

export function BookCard({ book }: { book: CatalogBook }) {
  return (
    <article className="book-card">
      <Link
        className={`book-cover ${book.coverClass}`}
        href={`/books/${book.slug}`}
        aria-label={`View ${book.title} by ${book.author}`}
      >
        <span>{book.coverMark}</span>
        <small>{book.author}</small>
      </Link>
      <p className="book-author">{book.author}</p>
      <h3><Link href={`/books/${book.slug}`}>{book.title}</Link></h3>
      <div className="book-card-meta">
        <p className="book-price">{book.price}</p>
        <span>{book.genre}</span>
      </div>
    </article>
  );
}
