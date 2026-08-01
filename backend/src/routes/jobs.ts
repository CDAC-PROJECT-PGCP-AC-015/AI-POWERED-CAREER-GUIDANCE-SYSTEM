import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { cached, tavilySearch, type TavilyResult } from "../lib/tavily.js";

export const jobsRouter = Router();
jobsRouter.use(requireAuth);

const TTL_MS = 60 * 60 * 1000; // 1 hour
const JOB_BOARD_DOMAINS = ["linkedin.com", "naukri.com", "indeed.com", "glassdoor.co.in", "instahyre.com"];

/**
 * GET /api/jobs?company=Amazon&role=Backend%20Developer
 * Returns real, currently-indexed job postings for this company + role.
 * `live: false` tells the frontend Tavily isn't configured / returned
 * nothing, so it should fall back to a generic job-board search link rather
 * than showing a broken or misleadingly-labeled result.
 */
jobsRouter.get("/", async (req, res) => {
  const company = String(req.query.company ?? "").trim();
  const role = String(req.query.role ?? "").trim();
  if (!company || !role) {
    return res.status(400).json({ error: "company and role query params are required" });
  }

  const cacheKey = `${company.toLowerCase()}|${role.toLowerCase()}`;
  const results = await cached("jobs", cacheKey, TTL_MS, () =>
    tavilySearch(`${role} jobs at ${company} hiring now`, {
      maxResults: 5,
      includeDomains: JOB_BOARD_DOMAINS,
    }),
  );

  if (!results || results.length === 0) {
    return res.json({ jobs: [], live: false });
  }
  res.json({ jobs: results.slice(0, 3) satisfies TavilyResult[], live: true });
});
