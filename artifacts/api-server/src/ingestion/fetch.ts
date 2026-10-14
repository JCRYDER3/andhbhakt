// Ported verbatim from jan-score's src/lib/ingestion/fetch.ts — no
// framework dependency, so no adaptation needed.
const lastRequestAtByHost = new Map<string, number>();

// Respect each source's robots.txt Crawl-delay — self-throttle per host to
// stay a good citizen of public civic-data infrastructure (data.gov.in,
// etc.) even when its own robots.txt is permissive.
const MIN_DELAY_MS = 10_000;

const USER_AGENT = "GovLensIndiaBot/0.1 (+civic accountability research; contact via project README)";

export async function politeFetch(url: string, init?: RequestInit): Promise<Response> {
  const host = new URL(url).host;
  const last = lastRequestAtByHost.get(host) ?? 0;
  const wait = MIN_DELAY_MS - (Date.now() - last);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAtByHost.set(host, Date.now());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal, headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) } });
  } finally {
    clearTimeout(timeout);
  }
}
