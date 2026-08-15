import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

export type BooklyDatabase = Database.Database;

const schema = `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customer_payment_methods (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    provider_token TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL,
    last4 TEXT NOT NULL,
    expiry_month INTEGER NOT NULL,
    expiry_year INTEGER NOT NULL,
    cardholder_name TEXT NOT NULL,
    billing_address1 TEXT NOT NULL,
    billing_address2 TEXT,
    billing_city TEXT NOT NULL,
    billing_state TEXT NOT NULL,
    billing_postal_code TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status TEXT NOT NULL,
    placed_at TEXT NOT NULL,
    shipped_at TEXT,
    delivered_at TEXT,
    estimated_delivery TEXT,
    carrier TEXT,
    tracking_number TEXT,
    subtotal_cents INTEGER NOT NULL,
    shipping_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_lines (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    sku TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    product_type TEXT NOT NULL DEFAULT 'physical',
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    refunded_quantity INTEGER NOT NULL DEFAULT 0 CHECK (refunded_quantity >= 0),
    unit_price_cents INTEGER NOT NULL,
    fulfillment_status TEXT NOT NULL,
    refundable_until TEXT,
    is_final_sale INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS catalog_items (
    sku TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    format TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    inventory_quantity INTEGER NOT NULL CHECK (inventory_quantity >= 0),
    active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(book_id, format)
  );

  CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    sku TEXT NOT NULL REFERENCES catalog_items(sku),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    added_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(cart_id, sku)
  );

  CREATE TABLE IF NOT EXISTS checkout_sessions (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL REFERENCES carts(id),
    status TEXT NOT NULL,
    checkout_url TEXT NOT NULL,
    totals_json TEXT NOT NULL,
    order_id TEXT REFERENCES orders(id),
    payment_id TEXT,
    paid_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
    checkout_id TEXT NOT NULL UNIQUE REFERENCES checkout_sessions(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    processor TEXT NOT NULL,
    payment_reference TEXT NOT NULL UNIQUE,
    payment_method_brand TEXT NOT NULL,
    payment_method_last4 TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wishlists (
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(customer_id, book_id)
  );

  CREATE TABLE IF NOT EXISTS stock_alerts (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sku TEXT NOT NULL REFERENCES catalog_items(sku),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    UNIQUE(customer_id, sku, status)
  );

  CREATE TABLE IF NOT EXISTS shipment_events (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    occurred_at TEXT NOT NULL,
    status_code TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT
  );

  CREATE TABLE IF NOT EXISTS shipping_investigations (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    issue_type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    carrier_case_reference TEXT NOT NULL,
    expected_response_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shipping_investigation_quotes (
    token TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    customer_email TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    description TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refund_quotes (
    token TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    customer_email TEXT NOT NULL,
    items_json TEXT NOT NULL,
    reason TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_reference TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refund_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refund_id TEXT NOT NULL REFERENCES refunds(id),
    order_line_id INTEGER NOT NULL REFERENCES order_lines(id),
    quantity INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_action_quotes (
    token TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id),
    customer_email TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS replacement_orders (
    id TEXT PRIMARY KEY,
    original_order_id TEXT NOT NULL REFERENCES orders(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    estimated_ship_date TEXT NOT NULL,
    carrier TEXT,
    tracking_number TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS replacement_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    replacement_id TEXT NOT NULL REFERENCES replacement_orders(id) ON DELETE CASCADE,
    order_line_id INTEGER NOT NULL REFERENCES order_lines(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );

  CREATE TABLE IF NOT EXISTS return_requests (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status TEXT NOT NULL,
    return_method TEXT NOT NULL,
    label_url TEXT NOT NULL,
    qr_code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id TEXT NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    order_line_id INTEGER NOT NULL REFERENCES order_lines(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );

  CREATE TABLE IF NOT EXISTS support_cases (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    order_id TEXT REFERENCES orders(id),
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    queue TEXT NOT NULL,
    conversation_excerpt TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    modality TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tool_runs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    call_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    input_json TEXT NOT NULL,
    output_json TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);
  CREATE INDEX IF NOT EXISTS idx_catalog_items_book ON catalog_items(book_id);
  CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
  CREATE INDEX IF NOT EXISTS idx_payment_methods_customer ON customer_payment_methods(customer_id);
  CREATE INDEX IF NOT EXISTS idx_stock_alerts_customer ON stock_alerts(customer_id);
  CREATE INDEX IF NOT EXISTS idx_shipment_events_order_time ON shipment_events(order_id, occurred_at);
  CREATE INDEX IF NOT EXISTS idx_shipping_investigations_order ON shipping_investigations(order_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
  CREATE INDEX IF NOT EXISTS idx_replacements_original_order ON replacement_orders(original_order_id);
  CREATE INDEX IF NOT EXISTS idx_returns_order ON return_requests(order_id);
  CREATE INDEX IF NOT EXISTS idx_support_cases_customer ON support_cases(customer_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_session_created ON conversation_messages(session_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_tool_runs_session_created ON tool_runs(session_id, created_at);
`;

export function databasePath() {
  const configured = process.env.BOOKLY_DB_PATH;
  if (!configured) return join(process.cwd(), "data", "bookly.db");
  return isAbsolute(configured)
    ? configured
    : join(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function openBooklyDatabase(path = databasePath()) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(schema);
  const orderColumns = db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  const existingOrderColumns = new Set(orderColumns.map((column) => column.name));
  if (!existingOrderColumns.has("shipping_address1")) db.exec("ALTER TABLE orders ADD COLUMN shipping_address1 TEXT");
  if (!existingOrderColumns.has("shipping_address2")) db.exec("ALTER TABLE orders ADD COLUMN shipping_address2 TEXT");
  if (!existingOrderColumns.has("shipping_postal_code")) db.exec("ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT");
  const checkoutColumns = db.prepare("PRAGMA table_info(checkout_sessions)").all() as Array<{ name: string }>;
  const existingCheckoutColumns = new Set(checkoutColumns.map((column) => column.name));
  if (!existingCheckoutColumns.has("order_id")) db.exec("ALTER TABLE checkout_sessions ADD COLUMN order_id TEXT REFERENCES orders(id)");
  if (!existingCheckoutColumns.has("payment_id")) db.exec("ALTER TABLE checkout_sessions ADD COLUMN payment_id TEXT");
  if (!existingCheckoutColumns.has("paid_at")) db.exec("ALTER TABLE checkout_sessions ADD COLUMN paid_at TEXT");
  db.pragma("optimize");
  return db;
}

let databasePromise: Promise<BooklyDatabase> | undefined;

export async function getDatabase() {
  databasePromise ??= (async () => {
    const db = openBooklyDatabase();
    const { seedDatabase } = await import("./seed");
    await seedDatabase(db);
    return db;
  })();
  return databasePromise;
}
