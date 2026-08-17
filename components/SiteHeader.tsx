import Link from "next/link";
import { Menu, Search, Sparkles } from "lucide-react";
import { CartExperience } from "@/components/CartExperience";
import { SiteAccount } from "@/components/SiteAccount";

type SiteHeaderProps = {
  demoActive?: boolean;
};

export function SiteHeader({ demoActive = false }: SiteHeaderProps) {
  return (
    <>
      <div className="announcement">
        <span>Free shipping on orders $35+</span>
        <span className="announcement-detail">Easy 30-day returns</span>
      </div>

      <header className="site-header">
        <button className="icon-button mobile-menu" aria-label="Open navigation"><Menu size={21} /></button>
        <Link className="wordmark" href="/" aria-label="Bookly home">bookly<span>.</span></Link>
        <nav aria-label="Primary navigation">
          <Link href="/books">Browse</Link>
          <Link href="/books">New releases</Link>
          <Link href="/books">Reader favorites</Link>
          <Link href="/#about">Our story</Link>
          <Link
            className={`demo-nav-link${demoActive ? " active" : ""}`}
            href="/demo-explainer"
            aria-current={demoActive ? "page" : undefined}
          >
            <Sparkles size={12} /> Demo explainer
          </Link>
        </nav>
        <div className="header-actions">
          <Link className="header-search" href="/books#catalog-search" aria-label="Search books">
            <Search size={19} /><span>Search books</span>
          </Link>
          <Link className="demo-mobile-link" href="/demo-explainer" aria-current={demoActive ? "page" : undefined}>Demo</Link>
          <SiteAccount />
          <CartExperience />
        </div>
      </header>
    </>
  );
}
