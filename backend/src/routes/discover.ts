import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { cached, tavilySearch } from "../lib/tavily.js";

/**
 * "Discovery" routes — the same Tavily-powered real web search that
 * routes/jobs.ts already does for job postings, extended to courses and
 * companies. Grouped separately from jobsRouter because these two search
 * different domains and shape their results differently, but they share
 * the exact same "never fabricate, return live:false and let the caller
 * fall back" contract.
 */
export const discoverRouter = Router();
discoverRouter.use(requireAuth);

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — course catalogues & hiring pages change slower than job posts

const COURSE_DOMAINS = [
  "coursera.org",
  "udemy.com",
  "nptel.ac.in",
  "edx.org",
  "udacity.com",
  "freecodecamp.org",
  "linkedin.com",
];

const COMPANY_DOMAINS = ["linkedin.com", "naukri.com", "indeed.com", "glassdoor.co.in"];

/**
 * GET /api/discover/courses?title=Data%20Scientist
 * Real, currently-live courses/certifications for this career title, from
 * known course-provider domains only. `live:false` -> caller keeps whatever
 * LLM-generated or curated course content it already has.
 */
discoverRouter.get("/courses", async (req, res) => {
  const title = String(req.query.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "title query param is required" });

  const results = await cached("courses", title.toLowerCase(), TTL_MS, () =>
    tavilySearch(`${title} course certification`, { maxResults: 6, includeDomains: COURSE_DOMAINS }),
  );

  if (!results || results.length === 0) return res.json({ courses: [], live: false });

  const courses = results.slice(0, 4).map((r, i) => ({
    id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-live-${i}`,
    title: r.title,
    provider: r.source.replace(/\.(com|org|in|ac\.in)$/, ""),
    url: r.url,
  }));
  res.json({ courses, live: true });
});

/**
 * GET /api/discover/companies?role=Backend%20Developer
 * Real companies with currently-live job posts for this role, discovered
 * from actual search results rather than an LLM's general knowledge —
 * derives a company name from each result's page title (job-board titles
 * reliably follow a "<Role> at <Company>" / "<Company> hiring <Role>"
 * pattern) and de-duplicates. `live:false` -> caller keeps whatever
 * LLM-generated or curated company content it already has.
 */
discoverRouter.get("/companies", async (req, res) => {
  const role = String(req.query.role ?? "").trim();
  if (!role) return res.status(400).json({ error: "role query param is required" });

  const results = await cached("companies", role.toLowerCase(), TTL_MS, () =>
    tavilySearch(`${role} jobs hiring now India`, { maxResults: 10, includeDomains: COMPANY_DOMAINS }),
  );

  if (!results || results.length === 0) return res.json({ companies: [], live: false });

  const seen = new Set<string>();
  const companies: { name: string; role: string; url: string; source: string }[] = [];
  for (const r of results) {
    const name = extractCompanyName(r.title, role);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    companies.push({ name, role, url: r.url, source: r.source });
    if (companies.length >= 4) break;
  }

  res.json({ companies, live: companies.length > 0 });
});

/**
 * Job-board titles are fairly formulaic. This handles the two dominant
 * patterns without ever guessing a name that isn't actually in the title —
 * if neither pattern matches, we skip the result rather than invent one.
 *   "Backend Developer at Amazon | LinkedIn"        -> "Amazon"
 * "Amazon hiring Backend Developer in Bengaluru"     -> "Amazon"
 */
function extractCompanyName(title: string, role: string): string | null {
  const cleaned = title.replace(/\s*[\|\-–]\s*(LinkedIn|Naukri\.com|Indeed|Glassdoor).*$/i, "").trim();

  let m = cleaned.match(/\bat\s+([A-Z][\w&.,'’ -]{1,40}?)(?:\s*[-–,(]|\s+in\s+|\s+for\s+|$)/);
  if (m) return m[1].trim();

  m = cleaned.match(/^([A-Z][\w&.,'’ -]{1,40}?)\s+(?:is\s+)?hiring\b/i);
  if (m) return m[1].trim();

  m = cleaned.match(/^([A-Z][\w&.,'’ -]{1,40}?)\s*-\s*/);
  if (m && m[1].toLowerCase() !== role.toLowerCase()) return m[1].trim();

  return null;
}
