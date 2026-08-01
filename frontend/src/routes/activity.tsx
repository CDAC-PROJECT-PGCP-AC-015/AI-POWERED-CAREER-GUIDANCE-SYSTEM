import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuit, CalendarCheck, GraduationCap, Settings2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, Chip, SectionTitle } from "@/components/ui-kit";
import { useApp } from "@/lib/app-store";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — CareerAI" },
      { name: "description", content: "A full history of your assessments, mentor sessions and course enrolments." },
      { property: "og:title", content: "Activity — CareerAI" },
      { property: "og:description", content: "Every step of your CareerAI journey." },
    ],
  }),
  component: Activity,
});

const ICONS = {
  assessment: BrainCircuit,
  session: CalendarCheck,
  course: GraduationCap,
  system: Settings2,
} as const;

function Activity() {
  const { activity } = useApp();

  return (
    <AppShell>
      <SectionTitle title="Activity" subtitle="Everything you've done on CareerAI, newest first." />

      {activity.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">
            No activity yet. Complete the assessment or enroll in a course to start your history.
          </p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {activity.map((a) => {
              const Icon = ICONS[a.kind];
              return (
                <li key={a.id} className="flex gap-4 py-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent">
                    <Icon className="size-5 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{a.title}</p>
                      <Chip tone="neutral">{a.kind}</Chip>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(a.at).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
