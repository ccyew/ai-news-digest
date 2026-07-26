import type { NewsItem } from "./types.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PAGE_STYLE = `
  :root {
    color-scheme: light dark;
    --bg: #ffffff;
    --fg: #1a1a1a;
    --muted: #666666;
    --border: #e5e5e5;
    --accent: #b45309;
    --card-bg: #fafafa;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14161a;
      --fg: #e8e6e1;
      --muted: #9a9a9a;
      --border: #2a2d33;
      --accent: #f0a860;
      --card-bg: #1b1e24;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: 'Segoe UI', system-ui, sans-serif;
    line-height: 1.55;
  }
  .wrap { max-width: 760px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  header { margin-bottom: 2rem; }
  h1 { font-size: 1.8rem; margin: 0 0 0.35rem; }
  .subtitle { color: var(--muted); font-size: 0.95rem; }
  nav.archive-link { margin-top: 0.5rem; font-size: 0.9rem; }
  nav.archive-link a { color: var(--accent); text-decoration: none; }
  nav.archive-link a:hover { text-decoration: underline; }
  article.item {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.25rem 1.4rem;
    margin-bottom: 1.1rem;
  }
  article.item h2 { font-size: 1.15rem; margin: 0 0 0.4rem; }
  article.item h2 a { color: var(--fg); text-decoration: none; }
  article.item h2 a:hover { color: var(--accent); }
  .meta { color: var(--muted); font-size: 0.82rem; margin-bottom: 0.6rem; }
  .summary { margin: 0 0 0.7rem; }
  .links a { color: var(--accent); text-decoration: none; font-size: 0.88rem; margin-right: 1rem; }
  .links a:hover { text-decoration: underline; }
  footer { margin-top: 2.5rem; color: var(--muted); font-size: 0.82rem; text-align: center; }
  .empty { color: var(--muted); font-style: italic; }
`;

export function buildHtmlPage(items: NewsItem[], generatedAt: Date, isoDate: string): string {
  const dateLabel = generatedAt.toISOString().slice(0, 10);

  const body = items.length
    ? items
        .map((item) => {
          const time = item.publishedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
          const links = [`<a href="${escapeHtml(item.link)}">Read more</a>`];
          if (item.discussionUrl) links.push(`<a href="${escapeHtml(item.discussionUrl)}">HN Discussion</a>`);
          return `
    <article class="item">
      <h2><a href="${escapeHtml(item.link)}">${escapeHtml(item.title)}</a></h2>
      <div class="meta">${escapeHtml(item.source)} &middot; ${time}</div>
      <p class="summary">${escapeHtml(item.summary)}</p>
      <div class="links">${links.join("")}</div>
    </article>`;
        })
        .join("\n")
    : `<p class="empty">No AI news items found in the last 24 hours.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI News Digest — ${dateLabel}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>AI News Digest — ${dateLabel}</h1>
      <div class="subtitle">TechCrunch AI, The Verge AI, and Hacker News AI &middot; last 24 hours &middot; generated ${generatedAt.toISOString()}</div>
      <nav class="archive-link"><a href="./archive/">View past digests →</a></nav>
    </header>
    <main>
${body}
    </main>
    <footer>Generated automatically by ai-news-digest.</footer>
  </div>
</body>
</html>
`;
}

export function buildArchiveIndexPage(entries: { date: string; href: string }[]): string {
  const rows = entries
    .map((e) => `      <li><a href="${escapeHtml(e.href)}">${escapeHtml(e.date)}</a></li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI News Digest — Archive</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Archive</h1>
      <nav class="archive-link"><a href="../">← Back to latest</a></nav>
    </header>
    <main>
      <ul>
${rows}
      </ul>
    </main>
    <footer>Generated automatically by ai-news-digest.</footer>
  </div>
</body>
</html>
`;
}
