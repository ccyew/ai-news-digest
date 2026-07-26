import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import Anthropic from "@anthropic-ai/sdk";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ARTICLE_CHARS = 12_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ai-news-digest/1.0";

// jsdom logs non-fatal CSS parsing errors to the console by default; we don't
// render styles, so silence them rather than spamming stderr per article.
const silentVirtualConsole = new VirtualConsole();

/**
 * Fetches the linked article and extracts its full readable text via Readability.
 * Returns null on any failure (paywall, non-HTML content, timeout, etc.).
 */
export async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    const dom = new JSDOM(html, { url, virtualConsole: silentVirtualConsole });
    const article = new Readability(dom.window.document).parse();

    const text = article?.textContent?.trim();
    if (!text || text.length < 40) return null;

    return text.slice(0, MAX_ARTICLE_CHARS);
  } catch {
    return null;
  }
}

/**
 * Asks Claude to write a 2-3 sentence summary of the given source text.
 * `sourceText` may be the full article body or just an RSS excerpt when the
 * full article couldn't be fetched. Returns null on API failure so callers
 * can fall back to whatever raw text they already have.
 */
export async function generateAiSummary(
  client: Anthropic,
  title: string,
  sourceText: string
): Promise<string | null> {
  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 300,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: `Write a concise, informative 2-3 sentence summary of this news article for a daily AI news digest. Focus on the concrete facts and takeaways, not filler. Do not repeat the title verbatim. Return only the summary text, no preamble.\n\nTitle: ${title}\n\nArticle text:\n${sourceText}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") return null;

    const textBlock = response.content.find((b) => b.type === "text");
    const summary = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    return summary || null;
  } catch {
    return null;
  }
}
