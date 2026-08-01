import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, LifeBuoy, Mail, MessageSquare } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, SectionTitle } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — CareerAI" },
      { name: "description", content: "Answers about the assessment, the prediction model, mentors and courses on CareerAI." },
      { property: "og:title", content: "Help Center — CareerAI" },
      { property: "og:description", content: "Get unstuck on CareerAI in a minute." },
    ],
  }),
  component: Help,
});

const FAQ = [
  {
    q: "How does the career prediction work?",
    a: "Your 15 assessment answers plus your profile are sent to the prediction model, which scores you against thousands of job profiles and returns the three highest-probability careers with a confidence score each.",
  },
  {
    q: "Who writes the AI summary for each career?",
    a: "An LLM reads your answers and the model's output, then writes a short explanation of why the career fits, what your gaps are and the highest-leverage next move.",
  },
  {
    q: "Can I retake the assessment?",
    a: "Yes. Use Retake Assessment in the sidebar, or Reset journey in Settings to clear your previous results first.",
  },
  {
    q: "How are mentors matched to me?",
    a: "Mentors are tagged by domain expertise. We surface the ones whose expertise overlaps most with your predicted careers and detected skill gaps.",
  },
  {
    q: "Is my data stored anywhere?",
    a: "In this build your profile, answers and progress are kept locally in your browser, so you can explore the full experience without an account.",
  },
];

function Help() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <AppShell>
      <SectionTitle title="Help Center" subtitle="Common questions about how CareerAI works." />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {FAQ.map((f, i) => (
              <li key={f.q}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-[17px] font-medium">{f.q}</span>
                  <ChevronDown
                    className={cn(
                      "size-5 shrink-0 text-muted-foreground transition-transform",
                      open === i && "rotate-180",
                    )}
                  />
                </button>
                {open === i && (
                  <p className="px-6 pb-5 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <span className="grid size-12 place-items-center rounded-xl bg-accent">
            <LifeBuoy className="size-6 text-primary" />
          </span>
          <h2 className="mt-4 text-xl font-semibold">Still stuck?</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Reach the CareerAI team or ask your mentor directly.
          </p>
          <div className="mt-5 space-y-3">
            <a href="mailto:support@careerai.example">
              <Button variant="outline" className="w-full">
                <Mail className="size-4" /> Email support
              </Button>
            </a>
            <Link to="/mentorship" className="block">
              <Button className="w-full">
                <MessageSquare className="size-4" /> Ask a mentor
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
