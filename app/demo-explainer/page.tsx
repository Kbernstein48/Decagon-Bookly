import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  CircleUserRound,
  Database,
  Eye,
  Headphones,
  KeyRound,
  Layers3,
  MessageCircleMore,
  Mic2,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Bookly agent demo explainer",
  description: "See how Bookly turns realtime conversation into grounded, visible, and safely confirmed commerce and support actions.",
};

const operatingModel = [
  {
    number: "01",
    icon: MessageCircleMore,
    title: "Understand intent",
    copy: "The realtime agent listens, clarifies ambiguity, and selects a typed path in text or voice.",
  },
  {
    number: "02",
    icon: Database,
    title: "Ground the answer",
    copy: "Catalog, policy, account, and order systems provide the facts—never the model’s memory.",
  },
  {
    number: "03",
    icon: Eye,
    title: "Show the work",
    copy: "Book previews, cart changes, checkout, and tool traces stay visible around the conversation.",
  },
  {
    number: "04",
    icon: ShieldCheck,
    title: "Guard the consequence",
    copy: "Identity, live state, exact amounts, and confirmation are rechecked before sensitive actions commit.",
  },
];

const journeys = [
  {
    id: "product-demo",
    eyebrow: "Journey 01 · discovery to cart",
    title: "A recommendation becomes a visible storefront action.",
    copy: "Bookly moves from natural-language discovery to an exact purchasable edition. It opens the matching book beside the chat, resolves the canonical hardcover, and synchronizes the shopping bag in the surrounding UI.",
    prompt: "“Recommend a science-fiction book and add the hardcover.”",
    gif: "/bookly-product-demo.gif",
    alt: "Bookly recommends A Glass Horizon, opens its product details, and adds the hardcover to the synchronized cart.",
    tools: ["search_knowledge", "open_book", "search_catalog", "add_to_cart"],
    proof: "Canonical format, inventory, and price",
    icon: BookOpen,
  },
  {
    id: "checkout-demo",
    eyebrow: "Journey 02 · cart to confirmed order",
    title: "Checkout stays customer-controlled from review to receipt.",
    copy: "The concierge prepares an account-bound checkout, keeps the conversation live on the payment page, reviews saved delivery and mock payment details, and submits only after the customer has clearly authorized the purchase.",
    prompt: "“Add the hardcover, then check out and pay.”",
    gif: "/bookly-checkout-demo.gif",
    alt: "Bookly adds a hardcover, authenticates the customer, reviews checkout, and completes a simulated order.",
    tools: ["add_to_cart", "begin_checkout", "review_checkout", "submit_order"],
    proof: "One reviewed total, one idempotent order",
    icon: ShoppingBag,
  },
  {
    id: "refund-demo",
    eyebrow: "Journey 03 · identity to resolution",
    title: "Sensitive resolutions earn trust one checkpoint at a time.",
    copy: "Credentials stay in a private inline form, outside the model conversation. Bookly then verifies order ownership and eligibility, calculates the exact refund, asks for a later-turn confirmation, and commits the transaction atomically.",
    prompt: "“Refund the damaged hardcover from order 5678.”",
    gif: "/bookly-refund-login-demo.gif",
    alt: "Bookly opens a private sign-in form, verifies an order, prepares an exact refund, and processes it after confirmation.",
    tools: ["authenticate_customer", "lookup_order", "prepare_refund", "process_refund"],
    proof: "Private sign-in and one-time confirmation token",
    icon: KeyRound,
  },
];

const capabilities = [
  {
    icon: Mic2,
    title: "Realtime text + voice",
    copy: "Live transcription, semantic turn detection, and barge-in make the same customer journeys natural in either modality.",
    label: "One continuous session",
  },
  {
    icon: Search,
    title: "Grounded discovery",
    copy: "Semantic knowledge retrieval finds useful matches; structured catalog tools then resolve exact books, formats, prices, and stock.",
    label: "LanceDB + canonical catalog",
  },
  {
    icon: Layers3,
    title: "Agentic storefront UI",
    copy: "The agent can open product detail views, update the shared cart, and carry context into a dedicated checkout experience.",
    label: "Conversation as control surface",
  },
  {
    icon: CircleUserRound,
    title: "Protected account context",
    copy: "A reusable private form establishes identity while server-verified sessions enforce ownership for orders and saved items.",
    label: "Credentials stay outside chat",
  },
  {
    icon: PackageCheck,
    title: "End-to-end resolutions",
    copy: "Order changes, delivery investigations, returns, replacements, and refunds share exact eligibility and confirmation patterns.",
    label: "Safe by construction",
  },
  {
    icon: Headphones,
    title: "Auditable human handoff",
    copy: "Every tool exposes status, latency, input, and output. Escalations persist a concise, evidence-rich case before queueing a person.",
    label: "Context travels with the customer",
  },
];

const toolGroups = [
  {
    label: "Discover",
    icon: Search,
    tools: ["search_knowledge", "search_catalog", "get_book", "open_book"],
  },
  {
    label: "Shop + checkout",
    icon: ShoppingBag,
    tools: ["get_cart", "add_to_cart", "update_cart_item", "remove_from_cart", "clear_cart", "begin_checkout", "review_checkout", "submit_order"],
  },
  {
    label: "Save for later",
    icon: BookOpen,
    tools: ["get_wishlist", "add_to_wishlist", "remove_from_wishlist", "create_back_in_stock_alert"],
  },
  {
    label: "Accounts + orders",
    icon: UserRoundCheck,
    tools: ["authenticate_customer", "lookup_order", "check_order_modification_eligibility", "cancel_order", "update_shipping_address"],
  },
  {
    label: "Resolve",
    icon: PackageCheck,
    tools: ["investigate_shipment", "open_shipping_investigation", "prepare_refund", "process_refund", "prepare_replacement", "create_replacement", "create_return_label", "get_return_status"],
  },
  {
    label: "Escalate",
    icon: Headphones,
    tools: ["create_support_case", "handoff_to_agent"],
  },
];

const trustSteps = [
  { label: "Discover", title: "Instant and low-friction", copy: "Search knowledge, compare books, and open detail views.", icon: Search },
  { label: "Personalize", title: "Identity becomes explicit", copy: "Private sign-in unlocks saved items and owned order data.", icon: CircleUserRound },
  { label: "Prepare", title: "The exact action is previewed", copy: "Eligibility, scope, price, tax, and live state are assembled first.", icon: Wrench },
  { label: "Commit", title: "A later confirmation seals it", copy: "A short-lived token and transaction protect the final side effect.", icon: ShieldCheck },
];

export default function DemoExplainerPage() {
  return (
    <main className="demo-explainer-page">
      <SiteHeader demoActive />

      <section className="demo-hero">
        <div className="demo-hero-copy">
          <p className="demo-kicker"><Sparkles size={13} /> Inside the Bookly agent</p>
          <h1>One conversation.<br /><em>Every customer journey.</em></h1>
          <p className="demo-hero-description">
            Bookly is a realtime commerce concierge that can understand, retrieve, act, and resolve—while keeping every important decision visible and every sensitive action safely confirmed.
          </p>
          <div className="demo-hero-actions">
            <Link className="primary-cta" href="#product-demo">Watch the journeys <ArrowDown size={18} /></Link>
            <Link className="demo-text-link" href="/">Try the live concierge <ArrowRight size={17} /></Link>
          </div>
          <div className="demo-proof-row" aria-label="Bookly demo highlights">
            <span><strong>31</strong> typed tools</span>
            <span><strong>2</strong> modalities</span>
            <span><strong>1</strong> shared customer state</span>
          </div>
        </div>

        <div className="demo-loop-card" aria-label="The Bookly agent decision loop">
          <div className="demo-loop-orbit orbit-one" aria-hidden="true" />
          <div className="demo-loop-orbit orbit-two" aria-hidden="true" />
          <header>
            <span><Bot size={16} /> Live decision loop</span>
            <small><i /> ready</small>
          </header>
          <div className="demo-loop-steps">
            {operatingModel.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.number}>
                  <div className="demo-loop-icon"><Icon size={18} /></div>
                  <div><small>{item.number}</small><strong>{item.title}</strong></div>
                  {index < operatingModel.length - 1 && <ChevronRight size={16} aria-hidden="true" />}
                </article>
              );
            })}
          </div>
          <footer><ShieldCheck size={15} /> Model for conversation. Code for control.</footer>
        </div>
      </section>

      <section className="demo-model-section" aria-labelledby="operating-model-title">
        <div className="demo-section-heading centered">
          <p className="demo-kicker">How it works</p>
          <h2 id="operating-model-title">Conversation leads. <em>Code commits.</em></h2>
          <p>Bookly separates natural dialogue from authoritative data and real side effects.</p>
        </div>
        <div className="demo-model-grid">
          {operatingModel.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.number}>
                <div className="demo-model-top"><span>{item.number}</span><Icon size={21} /></div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="demo-journeys-section" aria-labelledby="journeys-title">
        <div className="demo-section-heading">
          <p className="demo-kicker">Recorded product tours</p>
          <h2 id="journeys-title">Three journeys. <em>Zero hand-waving.</em></h2>
          <p>Watch the agent reason through the same UI, data, and safeguards a customer experiences.</p>
        </div>

        <div className="demo-journeys-list">
          {journeys.map((journey, index) => {
            const Icon = journey.icon;
            return (
              <article className={`demo-journey${index % 2 ? " reversed" : ""}`} id={journey.id} key={journey.id}>
                <div className="demo-journey-copy">
                  <div className="demo-journey-number">0{index + 1}</div>
                  <p className="demo-kicker"><Icon size={13} /> {journey.eyebrow}</p>
                  <h3>{journey.title}</h3>
                  <p>{journey.copy}</p>
                  <blockquote>{journey.prompt}</blockquote>
                  <div className="demo-tool-path" aria-label="Tools used in this journey">
                    {journey.tools.map((tool, toolIndex) => (
                      <span key={tool}><code>{tool}</code>{toolIndex < journey.tools.length - 1 && <ChevronRight size={12} />}</span>
                    ))}
                  </div>
                  <p className="demo-journey-proof"><Check size={14} /> {journey.proof}</p>
                </div>
                <figure className="demo-gif-frame">
                  <div className="demo-browser-bar" aria-hidden="true"><span /><span /><span /><small>bookly · live product walkthrough</small></div>
                  <Image src={journey.gif} alt={journey.alt} width={1280} height={800} unoptimized />
                  <figcaption><span>Live walkthrough</span><small>Recorded from the working Bookly demo</small></figcaption>
                </figure>
              </article>
            );
          })}
        </div>
      </section>

      <section className="demo-capabilities-section" aria-labelledby="capabilities-title">
        <div className="demo-section-heading centered">
          <p className="demo-kicker">Cornerstone capabilities</p>
          <h2 id="capabilities-title">Built for the whole <em>support arc.</em></h2>
          <p>From the first question to the final resolution, the agent shares context with the storefront and knows when to slow down.</p>
        </div>
        <div className="demo-capabilities-grid">
          {capabilities.map((capability, index) => {
            const Icon = capability.icon;
            return (
              <article key={capability.title}>
                <div className="demo-capability-icon"><Icon size={22} /></div>
                <span>0{index + 1}</span>
                <h3>{capability.title}</h3>
                <p>{capability.copy}</p>
                <small>{capability.label}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="demo-tools-section" aria-labelledby="tools-title">
        <div className="demo-tools-heading">
          <div>
            <p className="demo-kicker"><Wrench size={13} /> The agent’s toolkit</p>
            <h2 id="tools-title">31 typed tools.<br /><em>One coherent journey.</em></h2>
          </div>
          <p>Each call is schema-validated, server-executed, returned to the conversation, and rendered as an inspectable trace with input, output, status, and latency.</p>
        </div>
        <div className="demo-tool-groups">
          {toolGroups.map((group) => {
            const Icon = group.icon;
            return (
              <article key={group.label}>
                <header><span><Icon size={17} /></span><h3>{group.label}</h3><small>{group.tools.length}</small></header>
                <div>{group.tools.map((tool) => <code key={tool}>{tool}</code>)}</div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="demo-trust-section" aria-labelledby="trust-title">
        <div className="demo-trust-copy">
          <p className="demo-kicker"><ShieldCheck size={13} /> Progressive trust</p>
          <h2 id="trust-title">The higher the stakes, <em>the stronger the guardrail.</em></h2>
          <p>Bookly keeps discovery effortless, then progressively introduces identity, exact previews, explicit confirmation, and transactional protection as consequences grow.</p>
          <div className="demo-trust-note"><KeyRound size={18} /><span><strong>Sensitive actions never rely on chat alone.</strong> Ownership and state are revalidated on the server at commit time.</span></div>
        </div>
        <ol className="demo-trust-ladder">
          {trustSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.label}>
                <span className="demo-trust-index">{index + 1}</span>
                <span className="demo-trust-icon"><Icon size={17} /></span>
                <div><small>{step.label}</small><strong>{step.title}</strong><p>{step.copy}</p></div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="demo-final-cta">
        <div>
          <p className="demo-kicker"><Sparkles size={13} /> See it in the product</p>
          <h2>Ask naturally.<br /><em>Watch Bookly work.</em></h2>
        </div>
        <div>
          <p>Open the live concierge and try a recommendation, a missing delivery, or a human handoff. Every tool call will appear inside the conversation.</p>
          <Link className="demo-light-cta" href="/">Try the live demo <ArrowRight size={18} /></Link>
        </div>
      </section>
    </main>
  );
}
