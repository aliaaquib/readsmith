import type { WebsiteSignals } from "./types";

/**
 * Fetch a live website and extract product-level signals.
 * Uses lightweight HTML parsing (regex + entity decode) to avoid a DOM dependency.
 * Never throws for content problems — returns notes instead so the pipeline continues.
 */
export async function analyzeWebsite(rawUrl: string): Promise<WebsiteSignals> {
  const fetchNotes: string[] = [];
  const url = normalizeUrl(rawUrl);

  const base: WebsiteSignals = {
    url,
    finalUrl: url,
    headings: [],
    navLinks: [],
    ctaTexts: [],
    images: [],
    bodyExcerpt: "",
    fetchNotes,
  };

  let html = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Readsmith/1.0; +https://github.com) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    base.finalUrl = res.url || url;
    if (!res.ok) {
      fetchNotes.push(`Website returned HTTP ${res.status}.`);
      return base;
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      fetchNotes.push(`Website is not HTML (${contentType || "unknown type"}).`);
      return base;
    }
    html = await res.text();
  } catch (err) {
    fetchNotes.push(
      `Could not reach the website${err instanceof Error ? `: ${err.message}` : "."}`
    );
    return base;
  }

  const origin = safeOrigin(base.finalUrl);

  base.title = decode(matchTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  base.description = meta(html, "description");
  base.ogTitle = metaProp(html, "og:title");
  base.ogDescription = metaProp(html, "og:description");
  base.siteName = metaProp(html, "og:site_name");
  const ogImageRaw = metaProp(html, "og:image") || metaProp(html, "twitter:image");
  base.ogImage = ogImageRaw ? absolutize(ogImageRaw, origin) : undefined;

  base.headings = extractHeadings(html);
  base.navLinks = extractNav(html);
  base.ctaTexts = extractCtas(html);
  base.images = extractImages(html, origin);
  base.bodyExcerpt = extractText(html).slice(0, 4000);

  return base;
}

function normalizeUrl(input: string): string {
  const t = input.trim();
  if (!t) throw new Error("Provide a website URL.");
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    return u.toString();
  } catch {
    throw new Error("That doesn't look like a valid website URL.");
  }
}

function safeOrigin(u: string): string {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
}

function absolutize(src: string, origin: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (!origin) return src;
  return src.startsWith("/") ? `${origin}${src}` : `${origin}/${src}`;
}

function matchTag(html: string, re: RegExp): string | undefined {
  const m = re.exec(html);
  return m ? m[1].trim() : undefined;
}

function meta(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+name=["']${escapeRe(name)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${escapeRe(name)}["']`,
    "i"
  );
  const m = re.exec(html) || alt.exec(html);
  return m ? decode(m[1]) : undefined;
}

function metaProp(html: string, prop: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+property=["']${escapeRe(prop)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${escapeRe(prop)}["']`,
    "i"
  );
  const m = re.exec(html) || alt.exec(html);
  return m ? decode(m[1]) : undefined;
}

function extractHeadings(html: string): string[] {
  const out: string[] = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 25) {
    const text = decode(stripTags(m[2])).trim();
    if (text && text.length < 160) out.push(text);
  }
  return dedupe(out);
}

function extractNav(html: string): string[] {
  const navBlocks = [...html.matchAll(/<nav[^>]*>([\s\S]*?)<\/nav>/gi)].map((m) => m[1]);
  const header = /<header[^>]*>([\s\S]*?)<\/header>/i.exec(html)?.[1];
  const scope = (navBlocks.join(" ") + " " + (header || "")) || html;
  const links = [...scope.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => decode(stripTags(m[1])).trim())
    .filter((t) => t && t.length > 1 && t.length < 40);
  return dedupe(links).slice(0, 20);
}

function extractCtas(html: string): string[] {
  const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)].map((m) =>
    decode(stripTags(m[1])).trim()
  );
  const linkButtons = [...html.matchAll(/<a[^>]*class=["'][^"']*(btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)].map(
    (m) => decode(stripTags(m[2])).trim()
  );
  return dedupe([...buttons, ...linkButtons].filter((t) => t && t.length < 40)).slice(0, 12);
}

function extractImages(html: string, origin: string): string[] {
  const srcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((s) => !s.startsWith("data:"))
    .map((s) => absolutize(s, origin));
  return dedupe(srcs).slice(0, 15);
}

function extractText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  return decode(stripTags(withoutScripts)).replace(/\s+/g, " ").trim();
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ");
}

function decode(s?: string): string {
  if (!s) return "";
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}
