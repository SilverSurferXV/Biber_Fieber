import { schema, OutputType } from "./ffb_GET.schema";
import superjson from "superjson";

// In-memory cache as requested by the user
let cachedItems: Array<{ title: string; link: string; pubDate: string }> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const extractTag = (tag: string, text: string): string => {
  // Matches <tag>content</tag> or <tag><![CDATA[content]]></tag>
  const regex = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
  const match = text.match(regex);
  return match ? match[1].trim() : "";
};

export async function handle(request: Request) {
  try {
    const now = Date.now();

    // Check if cache is valid
    if (cachedItems && now - cacheTimestamp < CACHE_TTL_MS) {
      return new Response(superjson.stringify({ items: cachedItems } satisfies OutputType));
    }

    const rssResponse = await fetch("https://rss.sueddeutsche.de/rss/fuerstenfeldbruck");
    if (!rssResponse.ok) {
      throw new Error(`Failed to fetch RSS feed: ${rssResponse.statusText}`);
    }

    const xml = await rssResponse.text();

    const items: Array<{ title: string; link: string; pubDate: string }> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    // Parse up to 8 items using regex
    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
      const itemXml = match[1];
      const title = extractTag("title", itemXml);
      const link = extractTag("link", itemXml);
      const pubDate = extractTag("pubDate", itemXml);

      if (title && link && pubDate) {
        items.push({ title, link, pubDate });
      }
    }

    // Update cache
    cachedItems = items;
    cacheTimestamp = now;

    return new Response(superjson.stringify({ items } satisfies OutputType));
  } catch (error) {
    return new Response(
      superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500 }
    );
  }
}