import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Download, GraduationCap, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Chip, ProgressBar, SectionTitle, confidenceTone } from "@/components/ui-kit";
import { api } from "@/lib/api-client";
import { useApp, useCareers } from "@/lib/app-store";
import { downloadCareerReport } from "@/lib/report";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your Top 3 Career Matches — CareerAI" },
      {
        name: "description",
        content:
          "AI-generated summaries for your three highest-probability careers, with companies, mentors and courses.",
      },
      { property: "og:title", content: "Your Top 3 Career Matches — CareerAI" },
      { property: "og:description", content: "See what the model predicted for you and why." },
    ],
  }),
  component: Results,
});

function Results() {
  const careers = useCareers();
  const { profile, authed } = useApp();

  // c.mentors is static demo/curated data (empty for most of the 31 real
  // careers) — fetch the REAL mentor count per career from the backend so
  // this matches what the Career Guidance page's "Mentors" tab actually
  // shows, instead of contradicting it (e.g. "0 mentors available" here
  // while Guidance lists 3).
  const [liveMentorCounts, setLiveMentorCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!authed) return;
    const top3 = careers.slice(0, 3);
    Promise.all(
      top3.map((c) =>
        api
          .get<{ mentors: unknown[] }>(`/mentors?career=${encodeURIComponent(c.title)}`)
          .then((res) => [c.id, res.mentors.length] as const)
          .catch(() => [c.id, c.mentors.length] as const),
      ),
    ).then((entries) => setLiveMentorCounts(Object.fromEntries(entries)));
    // careers is derived from stable predictions for this render; only
    // re-fetch when the signed-in state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  return (
    <AppShell>
      <SectionTitle
        title="Your Top 3 Career Matches"
        subtitle="Predicted by the model and summarised by AI, based on your 15 assessment responses."
        action={
          <Link to="/guidance" search={{ career: careers[0]?.id }}>
            <Button>
              Explore guidance <ArrowRight className="size-4" />
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {careers.slice(0, 3).map((c, i) => (
          <Card key={c.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Chip tone="neutral">Rank #{i + 1}</Chip>
                <h2 className="mt-3 text-xl font-bold">{c.title}</h2>
              </div>
              <span className="text-2xl font-bold text-primary">{c.confidence}%</span>
            </div>
            <ProgressBar
              value={c.confidence}
              tone={confidenceTone(c.confidence)}
              className="mt-4"
            />
            <p className="mt-4 text-sm text-muted-foreground">{c.blurb}</p>

            <div className="mt-5 rounded-xl bg-accent p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
                <Sparkles className="size-4" /> AI Summary
              </p>
              <p className="mt-2 text-sm leading-relaxed text-accent-foreground/85">
                {c.aiSummary}
              </p>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Salary range</dt>
                <dd className="font-semibold">{c.salaryRange}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Market demand</dt>
                <dd className="font-semibold">{c.demand}</dd>
              </div>
            </dl>

            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" /> {c.companies.length} matched companies
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-4 text-primary" /> {liveMentorCounts[c.id] ?? c.mentors.length} mentors available
              </li>
              <li className="flex items-center gap-2">
                <GraduationCap className="size-4 text-primary" /> {c.courses.length} recommended
                courses
              </li>
            </ul>

            <div className="mt-6 flex gap-2">
              <Link to="/guidance" search={{ career: c.id }} className="flex-1">
                <Button variant="outline" className="w-full">
                  View full guidance <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                aria-label="Download report"
                onClick={() => downloadCareerReport(c, profile)}
              >
                <Download className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
