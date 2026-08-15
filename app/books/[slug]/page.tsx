import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Headphones, LibraryBig, Tablet } from "lucide-react";
import { BookCard } from "@/components/BookCard";
import { SiteHeader } from "@/components/SiteHeader";
import { catalogBooks, getCatalogBook, relatedBooksFor } from "@/lib/catalog";

type BookPageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return catalogBooks.map((book) => ({ slug: book.slug }));
}

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const book = getCatalogBook((await params).slug);
  if (!book) return {};
  return {
    title: `${book.title} by ${book.author} | Bookly`,
    description: book.description,
    alternates: { canonical: `/books/${book.slug}` },
    openGraph: {
      title: `${book.title} by ${book.author}`,
      description: book.description,
      type: "book",
    },
  };
}

function formatLabel(format: string) {
  return format.charAt(0).toUpperCase() + format.slice(1);
}

function FormatIcon({ format }: { format: string }) {
  if (format === "ebook") return <Tablet size={16} aria-hidden="true" />;
  if (format === "audiobook") return <Headphones size={16} aria-hidden="true" />;
  return <BookOpen size={16} aria-hidden="true" />;
}

export default async function BookPage({ params }: BookPageProps) {
  const book = getCatalogBook((await params).slug);
  if (!book) notFound();
  const related = relatedBooksFor(book);

  return (
    <main>
      <SiteHeader />

      <article className="book-detail">
        <nav className="book-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span>/</span><Link href="/books">Books</Link><span>/</span><span>{book.title}</span>
        </nav>

        <div className="book-detail-hero">
          <div className="book-detail-visual">
            <div className={`book-cover product-book-cover ${book.coverClass}`} aria-label={`Cover of ${book.title}`}>
              <span>{book.coverMark}</span>
              <small>{book.author}</small>
            </div>
            <p>{book.accent}</p>
          </div>

          <div className="book-detail-copy">
            <p className="product-detail-kicker"><span>{book.book_type}</span><span>{book.genre}</span></p>
            <h1>{book.title}</h1>
            <p className="product-detail-author">by <strong>{book.author}</strong></p>
            <p className="book-detail-price">{book.price}</p>
            <p className="product-detail-description">{book.description}</p>

            <div className="format-list" aria-label="Available formats">
              {book.formats.map((format) => (
                <span key={format}><FormatIcon format={format} />{formatLabel(format)}</span>
              ))}
            </div>

            <div className="book-detail-actions">
              <Link className="primary-cta" href="/books">Browse all books <ArrowRight size={17} /></Link>
              <span>Free shipping over $35 · Easy 30-day returns</span>
            </div>
          </div>
        </div>

        <section className="book-facts" aria-labelledby="book-details-heading">
          <div className="book-facts-heading">
            <LibraryBig size={24} aria-hidden="true" />
            <div><p className="eyebrow">On the shelf</p><h2 id="book-details-heading">Book details</h2></div>
          </div>
          <dl>
            <div><dt>Published</dt><dd>{book.publication_year}</dd></div>
            <div><dt>Length</dt><dd>{book.pages} pages</dd></div>
            <div><dt>Audience</dt><dd>{book.audience}</dd></div>
            <div><dt>ISBN</dt><dd>{book.isbn}</dd></div>
            <div><dt>Book type</dt><dd>{book.book_type}</dd></div>
            <div><dt>Genre</dt><dd>{book.genre}</dd></div>
          </dl>
          <div className="book-themes">
            <h3>What it explores</h3>
            <div>{book.themes.map((theme) => <span key={theme}>{theme}</span>)}</div>
          </div>
        </section>
      </article>

      <section className="related-books">
        <div className="section-heading">
          <div><p className="eyebrow">Keep browsing</p><h2>You might also like</h2></div>
          <Link href="/books">View all books <ArrowRight size={17} /></Link>
        </div>
        <div className="related-grid">
          {related.map((item) => <BookCard book={item} key={item.slug} />)}
        </div>
      </section>

      <Link className="back-to-books" href="/books"><ArrowLeft size={16} />Back to all books</Link>
    </main>
  );
}
