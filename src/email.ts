import nodemailer from "nodemailer";
import type { NewsItem } from "./types.js";

const TOP_STORIES_IN_EMAIL = 5;

function buildEmailBody(items: NewsItem[], siteUrl: string, dateLabel: string): { text: string; html: string } {
  const top = items.slice(0, TOP_STORIES_IN_EMAIL);

  const textLines = [
    `The AI News Digest for ${dateLabel} has been published.`,
    "",
    `View the full digest: ${siteUrl}`,
    "",
    `Top ${top.length} of ${items.length} stories today:`,
    "",
  ];
  const htmlItems: string[] = [];

  top.forEach((item, idx) => {
    textLines.push(`${idx + 1}. ${item.title} (${item.source})`, item.summary, item.link, "");
    htmlItems.push(
      `<li style="margin-bottom:1em;"><a href="${item.link}"><strong>${item.title}</strong></a><br><span style="color:#666;">${item.source}</span><p style="margin:0.3em 0 0;">${item.summary}</p></li>`
    );
  });

  const text = textLines.join("\n");
  const html = `
    <p>The AI News Digest for <strong>${dateLabel}</strong> has been published.</p>
    <p><a href="${siteUrl}">View the full digest (${items.length} stories)</a></p>
    <p><strong>Top ${top.length} stories today:</strong></p>
    <ol>${htmlItems.join("")}</ol>
    <p style="color:#999; font-size:0.85em;">Sent automatically by ai-news-digest.</p>
  `;

  return { text, html };
}

/**
 * Sends a summary email via Gmail SMTP using an App Password.
 * Returns true on success, false on failure (logged, never throws).
 */
export async function sendDigestEmail(items: NewsItem[], generatedAt: Date): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.EMAIL_TO;
  const siteUrl = process.env.SITE_URL;

  if (!user || !pass || !to || !siteUrl) {
    console.warn("WARNING: Skipping email — GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_TO, or SITE_URL not set in .env.");
    return false;
  }

  const dateLabel = generatedAt.toISOString().slice(0, 10);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    const { text, html } = buildEmailBody(items, siteUrl, dateLabel);

    await transporter.sendMail({
      from: user,
      to,
      subject: `AI News Digest — ${dateLabel} (${items.length} stories)`,
      text,
      html,
    });

    console.log(`Email sent to ${to}.`);
    return true;
  } catch (err) {
    console.error("WARNING: Failed to send digest email:", (err as Error).message);
    return false;
  }
}
