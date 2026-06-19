import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const publicDir = join(root, "public");
const dest = join(publicDir, "pdf.worker.min.mjs");

if (!existsSync(src)) {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found, skipping");
  process.exit(0);
}

mkdirSync(publicDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-pdf-worker] Copied pdf.worker.min.mjs to public/");
