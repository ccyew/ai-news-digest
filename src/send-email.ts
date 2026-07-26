import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sendDigestEmail } from "./email.js";
import type { NewsItem } from "./types.js";

const OUTPUT_DIR = fileURLToPath(new URL("../output/", import.meta.url));

async function main() {
  const snapshotPath = path.join(OUTPUT_DIR, "latest-items.json");
  const raw = await readFile(snapshotPath, "utf-8");
  const parsed = JSON.parse(raw) as { generatedAt: string; items: (Omit<NewsItem, "publishedAt"> & { publishedAt: string })[] };

  const generatedAt = new Date(parsed.generatedAt);
  const items: NewsItem[] = parsed.items.map((item) => ({
    ...item,
    publishedAt: new Date(item.publishedAt),
  }));

  const sent = await sendDigestEmail(items, generatedAt);
  if (!sent) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal error sending digest email:", err);
  process.exit(1);
});
