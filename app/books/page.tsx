import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Feather, Sparkles } from "lucide-react";
import { BookCatalog } from "@/components/BookCatalog";
import { SiteHeader } from "@/components/SiteHeader";
import { catalogBooks } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "All books | Bookly",
  description: "Browse every Bookly title by author, genre, or book type, and open a dedicated page for full details.",
};

export default function BooksPage() {
  const fictionCount = catalogBooks.filter((book) => book.book_type === "fiction").length;
  const nonfictionCount = catalogBooks.length - fictionCount;

  return (
    <main>
      <SiteHeader />

      <section className="catalog-hero">
        <div className="catalog-breadcrumb"><Link href="/">Home</Link><span>/</span><span>All books</span></div>
        <div className="catalog-hero-grid">
          <div>
            <p className="eyebrow">Find your next read</p>
            <h1>Every shelf has a story to <em>tell.</em></h1>
            <p>Explore our complete collection—from living cities and coastal mysteries to gardens, microclimates, and the tiny worlds under our feet.</p>
            <a className="catalog-jump" href="#catalog-search">Browse all {catalogBooks.length} books <ArrowRight size={17} /></a>
          </div>
          <div className="catalog-hero-art" aria-hidden="true">
            <div className="catalog-orbit orbit-one"><BookOpen size={23} /></div>
            <div className="catalog-orbit orbit-two"><Feather size={20} /></div>
            <div className="catalog-orbit orbit-three"><Sparkles size={19} /></div>
            <div className="catalog-stack catalog-stack-one"><span>FICTION</span><strong>{fictionCount}</strong></div>
            <div className="catalog-stack catalog-stack-two"><span>NONFICTION</span><strong>{nonfictionCount}</strong></div>
            <div className="catalog-stack catalog-stack-three"><span>AUTHORS</span><strong>{new Set(catalogBooks.map((book) => book.author)).size}</strong></div>
          </div>
        </div>
      </section>

      <BookCatalog books={catalogBooks} />

      <section className="catalog-assist">
        <div>
          <p className="eyebrow">A bookseller in your corner</p>
          <h2>Not sure where to begin?</h2>
        </div>
        <p>Tell Bookly what you&apos;re in the mood for. The concierge can search descriptions, themes, authors, book types, and genres to narrow the shelf.</p>
      </section>
    </main>
  );
}
