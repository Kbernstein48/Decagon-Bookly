import {
  ArrowRight,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { SiteHeader } from "@/components/SiteHeader";
import { catalogBooks } from "@/lib/catalog";

const featuredSlugs = ["the-orchard-book", "midnight-at-the-paper-moon", "atlas-of-small-wonders", "the-sea-between-us"];
const books = featuredSlugs.map((slug) => catalogBooks.find((book) => book.slug === slug)!);

export default function Home() {
  return (
    <main>
      <SiteHeader />

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Stories chosen for curious minds</p>
          <h1>Your next favorite story is <em>waiting.</em></h1>
          <p className="hero-description">
            Thoughtfully selected books, from page-turning fiction to ideas that stay with you.
          </p>
          <Link className="primary-cta" href="/books">Explore the collection <ArrowRight size={18} /></Link>
          <div className="reader-note">
            <div className="reader-avatars" aria-hidden="true"><span>JM</span><span>AR</span><span>SK</span></div>
            <p><strong>4.9 from 12,000+ readers</strong><br />A little corner of the internet for book people.</p>
          </div>
        </div>
        <div className="hero-art" aria-label="A colorful arrangement of featured books">
          <div className="hero-sun" />
          <div className="hero-arch" />
          <div className="hero-book hero-book-back"><span>THE QUIET<br />HOUR</span><small>ELENA MARSH</small></div>
          <div className="hero-book hero-book-front"><span>THE<br />ORCHARD<br />BOOK</span><small>NINA CALLOW</small></div>
          <div className="hero-leaf leaf-one" />
          <div className="hero-leaf leaf-two" />
          <div className="hero-sticker"><BookOpen size={23} /><span>READ<br />MORE</span></div>
        </div>
      </section>

      <section className="featured" id="featured">
        <div className="section-heading">
          <div><p className="eyebrow">Fresh from the shelves</p><h2>Books we can&apos;t stop talking about</h2></div>
          <Link href="/books">View all books <ArrowRight size={17} /></Link>
        </div>
        <div className="book-grid">
          {books.map((book) => <BookCard book={book} key={book.slug} />)}
        </div>
      </section>

      <section className="trust-strip" id="about">
        <div><strong>30 days</strong><span>Easy returns</span></div>
        <div><strong>4–7 days</strong><span>Standard delivery</span></div>
        <div><strong>Real people</strong><span>Here when you need us</span></div>
      </section>
    </main>
  );
}
