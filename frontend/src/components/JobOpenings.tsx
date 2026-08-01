import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { jobSearchLinks } from "@/lib/career-data";

type LiveJob = { title: string; url: string; source: string };

/**
 * "Current openings" for a company + role. Tries a real web search
 * (backend -> Tavily) for actual live postings first; if that's not
 * configured (no TAVILY_API_KEY) or comes up empty, falls back to
 * job-board SEARCH links (LinkedIn/Naukri/Indeed) instead of showing
 * nothing or a fabricated link.
 */
export function JobOpenings({ company, role }: { company: string; role: string }) {
  const [jobs, setJobs] = useState<LiveJob[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ jobs: LiveJob[]; live: boolean }>(
        `/jobs?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}`,
      )
      .then((res) => {
        if (!cancelled) setJobs(res.live ? res.jobs : []);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company, role]);

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Checking current openings…
      </div>
    );
  }

  if (jobs && jobs.length > 0) {
    return (
      <div className="mt-4 border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Live openings:</span>
        <ul className="mt-1.5 space-y-1">
          {jobs.map((j) => (
            <li key={j.url}>
              <a
                href={j.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-start gap-1 font-medium text-primary hover:underline"
              >
                <ExternalLink className="mt-0.5 size-3 shrink-0" />
                <span className="line-clamp-1">{j.title}</span>
                <span className="shrink-0 text-muted-foreground">· {j.source}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Fallback: no live search configured/found — search deep-links instead
  // of a fabricated "exact" posting URL.
  return (
    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
      <span className="w-full text-muted-foreground">Search current openings:</span>
      {jobSearchLinks(company, role).map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
