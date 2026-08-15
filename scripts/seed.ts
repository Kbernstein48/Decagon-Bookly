import { existsSync, rmSync } from "node:fs";
import { databasePath, openBooklyDatabase } from "../lib/database";
import { seedDatabase } from "../lib/seed";

const path = databasePath();
if (process.argv.includes("--reset") && existsSync(path)) {
  rmSync(path);
  for (const suffix of ["-shm", "-wal"]) {
    if (existsSync(`${path}${suffix}`)) rmSync(`${path}${suffix}`);
  }
}

const db = openBooklyDatabase(path);
await seedDatabase(db);
const summary = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM orders) AS orders,
    (SELECT COUNT(*) FROM order_lines) AS order_lines,
    (SELECT value FROM app_settings WHERE key = 'embedding_provider') AS embedding_provider,
    (SELECT value FROM app_settings WHERE key = 'knowledge_content_hash') AS knowledge_content_hash
`).get();
console.log("Bookly demo database ready:", summary);
db.close();
