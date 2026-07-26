import "dotenv/config";
import Parser from "rss-parser";
import Anthropic from "@anthropic-ai/sdk";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FEEDS } from "./feeds.js";
import { fetchArticleText, generateAiSummary } from "./summarize.js";
import { buildHtmlPage, buildArchiveIndexPage } from "./site.js";
import { sendDigestEmail } from "./email.js";
import type { NewsItem } from "./types.js";

const HOURS_WINDOW = 24;
const SUMMARY_MAX_LEN = 280;
const HN_SOURCE_NAME = "Hacker News AI";
const FEED_RETRY_ATTEMPTS = 3;
const FEED_RETRY_BASE_DELAY_MS = 2000;
const OUTPUT_DIR = fileURLToPath(new URL("../output/", import.meta.url));
const DOCS_DIR = fileURLToPath(new URL("../docs/", import.meta.url));
const ARCHIVE_DIR = path.join(DOCS_DIR, "archive");

const parser = new Parser();
const anthropic = new Anthropic();

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&#39;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

function parseHnMeta(raw: string): { discussionUrl?: string; fallbackSummary: string } {
  const commentsUrl = raw.match(/Comments URL:\s*(\S+)/)?.[1];
  const points = raw.match(/Points:\s*(\d+)/)?.[1];
  const comments = raw.match(/#?\s*Comments:\s*(\d+)/)?.[1];

  const bits: string[] = [];
  if (points) bits.push(`${points} points`);
  if (comments) bits.push(`${comments} comments`);

  return {
    discussionUrl: commentsUrl,
    fallbackSummary: bits.length ? `Discussion on Hacker News — ${bits.join(", ")}.` : "Discussion on Hacker News.",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseFeedWithRetry(name: string, url: string): Promise<Parser.Output<Record<string, unknown>>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FEED_RETRY_ATTEMPTS; attempt++) {
    try {
      return await parser.parseURL(url);
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === FEED_RETRY_ATTEMPTS;
      console.error(
        `Attempt ${attempt}/${FEED_RETRY_ATTEMPTS} failed for "${name}" (${url}): ${(err as Error).message}${
          isLastAttempt ? "" : " — retrying..."
        }`
      );
      if (!isLastAttempt) {
        await sleep(FEED_RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }
  throw lastError;
}

async function fetchFeed(name: string, url: string): Promise<NewsItem[]> {
  try {
    const feed = await parseFeedWithRetry(name, url);
    const items = (feed.items ?? []).flatMap((item): NewsItem[] => {
      const dateStr = item.isoDate ?? item.pubDate;
      if (!item.title || !item.link || !dateStr) return [];
      const publishedAt = new Date(dateStr);
      if (Number.isNaN(publishedAt.getTime())) return [];

      const rawSummary = item.contentSnippet ?? item.content ?? item.summary ?? "";

      if (name === HN_SOURCE_NAME) {
        const { discussionUrl, fallbackSummary } = parseHnMeta(rawSummary);
        return [
          {
            source: name,
            title: stripHtml(item.title),
            link: item.link,
            summary: fallbackSummary,
            publishedAt,
            discussionUrl,
          },
        ];
      }

      const cleanExcerpt = stripHtml(rawSummary);
      const summary = truncate(cleanExcerpt, SUMMARY_MAX_LEN);
      return [
        {
          source: name,
          title: stripHtml(item.title),
          link: item.link,
          summary: summary || "(no summary available)",
          publishedAt,
          rawExcerpt: cleanExcerpt || undefined,
        },
      ];
    });

    if (items.length === 0) {
      console.warn(`WARNING: "${name}" returned 0 usable items — feed may have changed shape or is temporarily empty.`);
    }

    return items;
  } catch (err) {
    console.error(
      `WARNING: Failed to fetch "${name}" (${url}) after ${FEED_RETRY_ATTEMPTS} attempts: ${(err as Error).message}. This source will be missing from today's digest.`
    );
    return [];
  }
}

async function enrichSummariesWithAi(items: NewsItem[]): Promise<void> {
  await Promise.all(
    items.map(async (item) => {
      const articleText = await fetchArticleText(item.link);
      const sourceText = articleText ?? item.rawExcerpt;
      if (!sourceText) return;

      const aiSummary = await generateAiSummary(anthropic, item.title, sourceText);
      if (aiSummary) {
        item.summary = aiSummary;
      }
    })
  );
}

function toMarkdown(items: NewsItem[], generatedAt: Date): string {
  const dateLabel = generatedAt.toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`# AI News Digest — ${dateLabel}`);
  lines.push("");
  lines.push(
    `Covering the last ${HOURS_WINDOW} hours across TechCrunch AI, The Verge AI, and Hacker News AI. Generated ${generatedAt.toISOString()}.`
  );
  lines.push("");

  if (items.length === 0) {
    lines.push("_No AI news items found in the last 24 hours._");
    lines.push("");
    return lines.join("\n");
  }

  items.forEach((item, idx) => {
    const time = item.publishedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
    lines.push(`## ${idx + 1}. ${item.title}`);
    lines.push("");
    lines.push(`**Source:** ${item.source} | **Published:** ${time}`);
    lines.push("");
    lines.push(item.summary);
    lines.push("");
    const links = [`[Read more](${item.link})`];
    if (item.discussionUrl) links.push(`[HN Discussion](${item.discussionUrl})`);
    lines.push(links.join(" | "));
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

async function writeSitePages(items: NewsItem[], now: Date): Promise<void> {
  const isoDate = now.toISOString().slice(0, 10);

  await mkdir(ARCHIVE_DIR, { recursive: true });

  const html = buildHtmlPage(items, now, isoDate);
  await writeFile(path.join(DOCS_DIR, "index.html"), html, "utf-8");
  await writeFile(path.join(ARCHIVE_DIR, `${isoDate}.html`), html, "utf-8");

  const archiveFiles = await readdir(ARCHIVE_DIR);
  const entries = archiveFiles
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
    .map((f) => ({ date: f.replace(".html", ""), href: `./${f}` }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  await writeFile(path.join(ARCHIVE_DIR, "index.html"), buildArchiveIndexPage(entries), "utf-8");
}

async function main() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - HOURS_WINDOW * 60 * 60 * 1000);

  const results = await Promise.all(FEEDS.map((f) => fetchFeed(f.name, f.url)));
  const allItems = results.flat();

  const recentItems = allItems
    .filter((item) => item.publishedAt >= cutoff)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  console.log(`Fetched ${allItems.length} total items, ${recentItems.length} within last ${HOURS_WINDOW}h.`);

  const breakdown = FEEDS.map((f) => `${f.name}=${recentItems.filter((i) => i.source === f.name).length}`).join(", ");
  console.log(`Source breakdown (last ${HOURS_WINDOW}h): ${breakdown}`);

  console.log("Fetching full articles and generating AI summaries...");
  await enrichSummariesWithAi(recentItems);

  const markdown = toMarkdown(recentItems, now);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `ai-news-digest-${now.toISOString().slice(0, 10)}.md`;
  const outPath = path.join(OUTPUT_DIR, filename);

  await writeFile(outPath, markdown, "utf-8");
  console.log(`Digest saved to ${outPath}`);

  await writeSitePages(recentItems, now);
  console.log(`Site pages written to ${DOCS_DIR}`);

  const snapshotPath = path.join(OUTPUT_DIR, "latest-items.json");
  await writeFile(snapshotPath, JSON.stringify({ generatedAt: now.toISOString(), items: recentItems }), "utf-8");
}

main().catch((err) => {
  console.error("Fatal error generating digest:", err);
  process.exit(1);
});
