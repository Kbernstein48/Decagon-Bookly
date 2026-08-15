import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = path.join(projectRoot, ".next", "standalone");

const assetDirectories = [
  {
    source: path.join(projectRoot, ".next", "static"),
    destination: path.join(standaloneRoot, ".next", "static"),
  },
  {
    source: path.join(projectRoot, "public"),
    destination: path.join(standaloneRoot, "public"),
  },
];

if (!existsSync(standaloneRoot)) {
  throw new Error("Standalone build output is missing. Run `next build` first.");
}

for (const { source, destination } of assetDirectories) {
  if (!existsSync(source)) continue;
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

console.log("Copied static and public assets into the standalone bundle.");
