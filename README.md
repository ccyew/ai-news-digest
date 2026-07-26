# AI News Digest

Fetches AI news from TechCrunch AI, The Verge AI, and Hacker News AI (via hnrss.org), keeps items from the last 24 hours, and writes a Markdown digest to `output/`.

## Usage

```
npm install
npm run digest
```

Output: `output/ai-news-digest-YYYY-MM-DD.md`

## Sources (src/feeds.ts)

- TechCrunch AI — https://techcrunch.com/category/artificial-intelligence/feed/
- The Verge AI — https://www.theverge.com/rss/ai-artificial-intelligence/index.xml
- Hacker News AI — https://hnrss.org/newest?q=AI&points=20 (HN stories mentioning "AI" with 20+ points)
