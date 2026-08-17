import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { BooklyDatabase } from "../lib/database";
import { openBooklyDatabase } from "../lib/database";
import { seedDatabase } from "../lib/seed";
import { executeTool } from "../lib/tools";

process.env.BOOKLY_EMBEDDING_MODE = "local";

describe("Bookly support tools", () => {
  let db: BooklyDatabase;
  const maya = { authenticatedCustomer: { id: 1, email: "maya.chen@example.com", firstName: "Maya", lastName: "Chen" } };
  const theo = { authenticatedCustomer: { id: 2, email: "theo.rivera@example.com", firstName: "Theo", lastName: "Rivera" } };

  before(async () => {
    db = openBooklyDatabase(":memory:");
    await seedDatabase(db);
  });

  after(() => db.close());

  test("requires a server-authenticated customer for account tools", async () => {
    const result = await executeTool(db, "lookup_order", { order_id: "1234" }) as {
      ok: boolean;
      error: { code: string };
    };
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "AUTHENTICATION_REQUIRED");
  });

  test("does not reveal an order unless the signed-in customer owns it", async () => {
    const result = await executeTool(db, "lookup_order", {
      order_id: "1234",
    }, theo) as { ok: boolean; error: { code: string; message: string } };
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "ORDER_VERIFICATION_FAILED");
    assert.doesNotMatch(result.error.message, /maya\.chen/i);
  });

  test("returns verified status and order-line detail", async () => {
    const result = await executeTool(db, "lookup_order", {
      order_id: "#1234",
    }, maya) as { ok: boolean; order: { status: string; lines: unknown[]; shipment: { carrier: string } } };
    assert.equal(result.ok, true);
    assert.equal(result.order.status, "in_transit");
    assert.equal(result.order.lines.length, 2);
    assert.equal(result.order.shipment.carrier, "UPS");
  });

  test("returns recent order details from the authenticated account without an email or order ID", async () => {
    const result = await executeTool(db, "lookup_order", {}, maya) as {
      ok: boolean;
      account: {
        first_name: string;
        order_count: number;
        orders: Array<{ order_id: string; status: string; lines: unknown[] }>;
      };
    };
    assert.equal(result.ok, true);
    assert.equal(result.account.first_name, "Maya");
    assert.equal(result.account.order_count, 2);
    assert.deepEqual(result.account.orders.map((order) => order.order_id), ["1234", "5678"]);
    assert.ok(result.account.orders.every((order) => order.lines.length > 0));
  });

  test("prevents a refund before delivery", async () => {
    const result = await executeTool(db, "prepare_refund", {
      order_id: "1234",
      items: [{ order_line_id: 1001, quantity: 1 }],
      reason: "Changed my mind",
    }, maya) as { ok: boolean; error: { code: string } };
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "ORDER_NOT_DELIVERED");
  });

  test("diagnoses a missing delivered package and requires preliminary checks", async () => {
    const unchecked = await executeTool(db, "investigate_shipment", {
      order_id: "5678",
      issue_type: "delivered_not_received",
      description: "The carrier says delivered but I cannot find the package.",
      preliminary_checks_completed: false,
    }, maya) as {
      ok: boolean;
      diagnostic: { events: unknown[]; latest_scan: { status_code: string } };
      investigation: { eligible: boolean; confirmation_token: string | null };
    };
    assert.equal(unchecked.ok, true);
    assert.equal(unchecked.investigation.eligible, false);
    assert.equal(unchecked.investigation.confirmation_token, null);
    assert.equal(unchecked.diagnostic.events.length, 4);
    assert.equal(unchecked.diagnostic.latest_scan.status_code, "delivered");

    const checked = await executeTool(db, "investigate_shipment", {
      order_id: "5678",
      issue_type: "delivered_not_received",
      description: "I checked household members, neighbors, and safe locations but cannot find it.",
      preliminary_checks_completed: true,
    }, maya) as {
      ok: boolean;
      investigation: { eligible: boolean; requires_confirmation: boolean; confirmation_token: string };
    };
    assert.equal(checked.ok, true);
    assert.equal(checked.investigation.eligible, true);
    assert.equal(checked.investigation.requires_confirmation, true);
    assert.match(checked.investigation.confirmation_token, /^[0-9a-f-]{36}$/i);
  });

  test("opens one confirmed simulated carrier investigation", async () => {
    const diagnostic = await executeTool(db, "investigate_shipment", {
      order_id: "5678",
      issue_type: "delivered_not_received",
      description: "All preliminary delivery-location checks are complete and the package is missing.",
      preliminary_checks_completed: true,
    }, maya) as { investigation: { confirmation_token: string } };

    const unconfirmed = await executeTool(db, "open_shipping_investigation", {
      confirmation_token: diagnostic.investigation.confirmation_token,
      customer_confirmed: false,
    }, maya) as { ok: boolean; error: { code: string } };
    assert.equal(unconfirmed.ok, false);
    assert.equal(unconfirmed.error.code, "CONFIRMATION_REQUIRED");

    const opened = await executeTool(db, "open_shipping_investigation", {
      confirmation_token: diagnostic.investigation.confirmation_token,
      customer_confirmed: true,
    }, maya) as {
      ok: boolean;
      investigation: { status: string; simulated_carrier_case: boolean; carrier_case_reference: string };
    };
    assert.equal(opened.ok, true);
    assert.equal(opened.investigation.status, "open");
    assert.equal(opened.investigation.simulated_carrier_case, true);
    assert.match(opened.investigation.carrier_case_reference, /^sim_usps_/);

    const duplicate = await executeTool(db, "open_shipping_investigation", {
      confirmation_token: diagnostic.investigation.confirmation_token,
      customer_confirmed: true,
    }, maya) as { ok: boolean; error: { code: string } };
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.error.code, "INVESTIGATION_QUOTE_ALREADY_USED");
  });

  test("requires confirmation, mutates once, and blocks duplicate refunds", async () => {
    const prepared = await executeTool(db, "prepare_refund", {
      order_id: "5678",
      items: [{ order_line_id: 2002, quantity: 1 }],
      reason: "I ordered one copy too many",
    }, maya) as { ok: boolean; confirmation_token: string; quote: { refund_total: string } };
    assert.equal(prepared.ok, true);
    assert.equal(prepared.quote.refund_total, "$14.03");

    const notConfirmed = await executeTool(db, "process_refund", {
      confirmation_token: prepared.confirmation_token,
      customer_confirmed: false,
    }, maya) as { ok: boolean; error: { code: string } };
    assert.equal(notConfirmed.ok, false);
    assert.equal(notConfirmed.error.code, "CONFIRMATION_REQUIRED");

    const completed = await executeTool(db, "process_refund", {
      confirmation_token: prepared.confirmation_token,
      customer_confirmed: true,
    }, maya) as { ok: boolean; refund: { status: string; simulated_payment_processor: boolean; reason: string } };
    assert.equal(completed.ok, true);
    assert.equal(completed.refund.status, "succeeded");
    assert.equal(completed.refund.simulated_payment_processor, true);
    assert.equal(completed.refund.reason, "I ordered one copy too many");

    const duplicate = await executeTool(db, "process_refund", {
      confirmation_token: prepared.confirmation_token,
      customer_confirmed: true,
    }, maya) as { ok: boolean; error: { code: string } };
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.error.code, "QUOTE_ALREADY_USED");

    const order = await executeTool(db, "lookup_order", {
      order_id: "5678",
    }, maya) as { order: { status: string; lines: Array<{ order_line_id: number; refundable_quantity: number }> } };
    assert.equal(order.order.status, "partially_refunded");
    assert.equal(order.order.lines.find((line) => line.order_line_id === 2002)?.refundable_quantity, 1);
  });

  test("retrieves only policy chunks when the required filter is policy", async () => {
    const result = await executeTool(db, "search_knowledge", {
      query: "How many days does standard shipping usually take?",
      filter: "policy",
    }) as {
      ok: boolean;
      retrieval: { engine: string; applied_filters: { filter: string }; result_count: number };
      matches: Array<{ document_type: string; title: string; section: string }>;
    };
    assert.equal(result.ok, true);
    assert.equal(result.retrieval.engine, "LanceDB");
    assert.equal(result.retrieval.applied_filters.filter, "policy");
    assert.equal(result.retrieval.result_count, 3);
    assert.ok(result.matches.every((match) => match.document_type === "policy"));
    assert.ok(result.matches.some((match) => match.title === "Shipping policy"));
  });

  test("filters books by author and type and returns verbose catalog metadata", async () => {
    const result = await executeTool(db, "search_knowledge", {
      query: "Which island or coastal story should I read?",
      filter: "books",
      book_type: "fiction",
      author: "mara voss",
    }) as {
      ok: boolean;
      retrieval: { applied_filters: { filter: string; book_type: string; author: string } };
      matches: Array<{
        document_type: string;
        description: string;
        metadata: { author: string; book_type: string; genre: string };
      }>;
    };
    assert.equal(result.ok, true);
    assert.deepEqual(result.retrieval.applied_filters, {
      filter: "books",
      book_type: "fiction",
      author: "mara voss",
    });
    assert.equal(result.matches.length, 2);
    assert.ok(result.matches.every((match) => match.document_type === "books"));
    assert.ok(result.matches.every((match) => match.metadata.author === "Mara Voss"));
    assert.ok(result.matches.every((match) => match.metadata.book_type === "fiction"));
    assert.ok(result.matches.every((match) => match.description.length > 500));
  });

  test("applies an exact genre filter before vector ranking", async () => {
    const result = await executeTool(db, "search_knowledge", {
      query: "I want a speculative story about climate and memory.",
      filter: "books",
      genre: "science fiction",
    }) as {
      ok: boolean;
      matches: Array<{ title: string; metadata: { genre: string } }>;
    };
    assert.equal(result.ok, true);
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].title, "A Glass Horizon");
    assert.equal(result.matches[0].metadata.genre, "science fiction");
  });

  test("rejects book metadata on policy searches", async () => {
    const result = await executeTool(db, "search_knowledge", {
      query: "What is the return window?",
      filter: "policy",
      author: "Mara Voss",
    }) as { ok: boolean; error: { code: string } };
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_TOOL_INPUT");
  });

  test("returns structured details for an exact book title", async () => {
    const result = await executeTool(db, "open_book", {
      title: "The Sea Between Us",
    }) as {
      ok: boolean;
      book: { slug: string; page_path: string; title: string; author: string; formats: string[] };
    };
    assert.equal(result.ok, true);
    assert.equal(result.book.slug, "the-sea-between-us");
    assert.equal(result.book.page_path, "/books/the-sea-between-us");
    assert.equal(result.book.author, "Mara Voss");
    assert.ok(result.book.formats.includes("audiobook"));
  });

  test("returns every exact title in one multi-book detail lookup", async () => {
    const result = await executeTool(db, "open_book", {
      titles: ["The Sea Between Us", "Salt Letters"],
    }) as {
      ok: boolean;
      opened_count: number;
      books: Array<{ slug: string; page_path: string; title: string; author: string }>;
    };
    assert.equal(result.ok, true);
    assert.equal(result.opened_count, 2);
    assert.deepEqual(result.books.map((book) => book.title), ["The Sea Between Us", "Salt Letters"]);
    assert.ok(result.books.every((book) => book.author === "Mara Voss"));
    assert.ok(result.books.every((book) => book.page_path === `/books/${book.slug}`));
  });

  test("opens valid titles and reports any missing title in a mixed lookup", async () => {
    const result = await executeTool(db, "open_book", {
      titles: ["Salt Letters", "A Book That Does Not Exist", "Salt Letters"],
    }) as {
      ok: boolean;
      opened_count: number;
      books: Array<{ title: string }>;
      not_found_titles: string[];
    };
    assert.equal(result.ok, true);
    assert.equal(result.opened_count, 1);
    assert.deepEqual(result.books.map((book) => book.title), ["Salt Letters"]);
    assert.deepEqual(result.not_found_titles, ["A Book That Does Not Exist"]);
  });

  test("does not open a title that is not in the catalog", async () => {
    const result = await executeTool(db, "open_book", {
      title: "A Book That Does Not Exist",
    }) as { ok: boolean; error: { code: string } };
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "BOOK_NOT_FOUND");
  });
});
