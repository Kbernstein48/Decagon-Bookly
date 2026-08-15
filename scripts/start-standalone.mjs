import { randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
process.env.BOOKLY_DB_PATH ||= path.join(projectRoot, "data", "bookly.db");
if (!process.env.BOOKLY_SESSION_SECRET) {
  process.env.BOOKLY_SESSION_SECRET = randomBytes(32).toString("base64url");
  console.warn("BOOKLY_SESSION_SECRET is not set; using an ephemeral local secret for this server process.");
}

await import(pathToFileURL(path.join(projectRoot, ".next", "standalone", "server.js")).href);
