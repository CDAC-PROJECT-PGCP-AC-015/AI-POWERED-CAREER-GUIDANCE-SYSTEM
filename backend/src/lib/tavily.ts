/**
 * Shared Tavily (https://tavily.com) web-search helper.
 *
 * One thin wrapper used by every "give me REAL, currently-live links"
 * feature in the app — job postings, courses, and companies currently
 * hiring. Centralised here (rather than duplicated per-route, as it
 * originally was in routes/jobs.ts) so all three share the same timeout,
 * error handling, and "return null instead of throwing" contract.
 *
 * Returns null (never a fabricated/broken link) if TAVILY_API_KEY isn't
 * configured or the search fails — callers are expected to fall back to a
 * generic search-page link or LLM-generated content in that case.
 */

export type TavilyResult = { title: string; url: string; source: string };

type TavilyOptions = {
  maxResults?: number;
  includeDomains?: string[];
};

function hostnameOf(url: string, fallback = "web"): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

export async function tavilySearch(
  query: string,
  { maxResults = 5, includeDomains }: TavilyOptions = {},
): Promise<TavilyResult[] | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null; // not configured -> caller falls back

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: maxResults,
        ...(includeDomains?.length ? { include_domains: includeDomains } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Tavily returned ${res.status}`);
    const json = (await res.json()) as { results?: { title: string; url: string }[] };
    return (json.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      source: hostnameOf(r.url, "job board"),
    }));
  } catch (err) {
    console.error(`[tavily] search failed for "${query}":`, err);
    return null;
  }
}

// In-memory TTL cache, shared shape used by jobs/courses/companies routes so
// repeatedly viewing the same career doesn't re-hit Tavily every time (and
// doesn't burn quota if many students land on the same popular career).
// Fine for a single backend instance; a real multi-instance deployment would
// want Redis instead, but that's more infra than this project needs.
type CacheEntry<T> = { data: T; expiresAt: number };
const caches = new Map<string, Map<string, CacheEntry<unknown>>>();

export function cached<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
): Promise<T> {
  if (!caches.has(namespace)) caches.set(namespace, new Map());
  const store = caches.get(namespace)!;
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.data);

  return compute().then((data) => {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}
