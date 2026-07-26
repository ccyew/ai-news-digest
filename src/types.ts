export interface FeedSource {
  name: string;
  url: string;
}

export interface NewsItem {
  source: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: Date;
  discussionUrl?: string;
  rawExcerpt?: string;
}
