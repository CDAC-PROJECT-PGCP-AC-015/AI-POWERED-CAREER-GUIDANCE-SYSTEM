import { createFileRoute } from "@tanstack/react-router";
import { Check, Circle, Target } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, Chip, ProgressBar, SectionTitle } from "@/components/ui-kit";
import { useApp, useCareers } from "@/lib/app-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/career-path")({
  head: () => ({
    meta: [
      { title: "Career Path — CareerAI" },
      { name: "description", content: "Your month-by-month roadmap for each predicted career, with checkable milestones." },
      { property: "og:title", content: "Career Path — CareerAI" },
      { property: "og:description", content: "Track every milestone on the way to your target role." },
    ],
  }),
  component: CareerPath,
});

function CareerPath() {
  const careers = useCareers();
  const { completedSteps, toggleStep } = useApp();

  const allSteps = careers.flatMap((c) => c.path.map((p) => `${c.id}:${p.phase}`));
  const doneCount = allSteps.filter((s) => completedSteps.includes(s)).length;

  return (
    <AppShell>
      <SectionTitle
        title="Your Career Paths"
        subtitle="A staged roadmap for each of your top 3 predicted careers. Tick milestones as you complete them."
      />

      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <Target className="size-5 text-primary" />
          <p className="font-medium">Overall roadmap progress</p>
          <span className="ml-auto text-sm font-semibold">
            {doneCount} / {allSteps.length} milestones
          </span>
        </div>
        <ProgressBar
          value={allSteps.length ? (doneCount / allSteps.length) * 100 : 0}
          tone="success"
          className="mt-4"
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {careers.slice(0, 3).map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{c.title}</h2>
              <Chip tone="neutral">{c.confidence}%</Chip>
            </div>
            <ol className="mt-5 space-y-4">
              {c.path.map((p) => {
                const key = `${c.id}:${p.phase}`;
                const done = completedSteps.includes(key);
                return (
                  <li key={key}>
                    <button
                      onClick={() => toggleStep(key)}
                      className="flex w-full items-start gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted"
                    >
                      {done ? (
                        <Check className="mt-0.5 size-5 shrink-0 text-success" />
                      ) : (
                        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      )}
                      <span>
                        <span
                          className={cn(
                            "block text-[15px] font-medium",
                            done && "text-muted-foreground line-through",
                          )}
                        >
                          {p.title}
                        </span>
                        <span className="block text-sm text-muted-foreground">{p.detail}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
