import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card, ProgressBar } from "@/components/ui-kit";
import { useApp } from "@/lib/app-store";
import { FALLBACK_CAREERS } from "@/lib/career-data";
import { predictCareers } from "@/lib/career.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analyzing")({
  head: () => ({
    meta: [
      { title: "Analyzing your responses — CareerAI" },
      {
        name: "description",
        content:
          "The prediction model is scoring your assessment against thousands of career profiles.",
      },
      { property: "og:title", content: "Analyzing your responses — CareerAI" },
      { property: "og:description", content: "Your top 3 career matches are being generated." },
    ],
  }),
  component: Analyzing,
});

const STAGES = [
  "Parsing your assessment responses",
  "Scoring skills against 4,000+ job profiles",
  "Ranking your top 3 career matches",
  "Writing AI summaries, mentors and roadmaps",
];

function Analyzing() {
  const navigate = useNavigate();
  const { profile, answers, setPredictions, logActivity, hydrated, saveResults } = useApp();
  const predict = useServerFn(predictCareers);
  const [stage, setStage] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 900);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;

    (async () => {
      let result = FALLBACK_CAREERS;
      try {
        result = await predict({ data: { profile: profile ?? {}, answers } });
      } catch {
        /* fall back to the built-in catalogue */
      }
      setPredictions(result);
      // Persist to the backend (server/src/routes/assessments.ts POST /:id/results) so
      // this shows up in assessment history and the admin dashboard. Best-effort —
      // the UI already has its predictions regardless of whether this succeeds.
      saveResults(
        result.map((c) => ({ title: c.title, confidence: c.confidence, narrative: c.aiSummary })),
      );
      logActivity({
        kind: "system",
        title: "Career prediction generated",
        detail: `Top match: ${result[0]?.title ?? "Software Engineer"} (${result[0]?.confidence ?? 0}% confidence).`,
      });
      setStage(STAGES.length - 1);
      setTimeout(() => navigate({ to: "/results" }), 900);
    })();
  }, [hydrated, answers, profile, predict, setPredictions, logActivity, saveResults, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-lg p-8 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent">
          <Loader2 className="size-8 animate-spin text-primary" />
        </span>
        <h1 className="mt-6 text-2xl font-bold">Analyzing your responses</h1>
        <p className="mt-2 text-muted-foreground">
          This usually takes a few seconds. Please don't close this tab.
        </p>
        <ProgressBar value={((stage + 1) / STAGES.length) * 100} className="mt-6" />
        <ul className="mt-7 space-y-3 text-left">
          {STAGES.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-[15px]">
              {i < stage ? (
                <Check className="size-5 shrink-0 text-success" />
              ) : i === stage ? (
                <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
              ) : (
                <span className="size-4 shrink-0 rounded-full border-2 border-border" />
              )}
              <span className={cn(i <= stage ? "text-foreground" : "text-muted-foreground")}>
                {s}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
