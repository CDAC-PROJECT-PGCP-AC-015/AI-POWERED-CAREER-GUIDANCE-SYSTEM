import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarPlus,
  Download,
  ExternalLink,
  GraduationCap,
  Route as RouteIcon,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ProgressBar,
  SectionTitle,
  confidenceTone,
} from "@/components/ui-kit";
import { api } from "@/lib/api-client";
import { useApp, useCareers } from "@/lib/app-store";
import { JobOpenings } from "@/components/JobOpenings";
import { downloadCareerReport } from "@/lib/report";
import { cn } from "@/lib/utils";

type BackendMentor = {
  id: string;
  title: string | null;
  company: string | null;
  expertiseTags: string[];
  bio: string | null;
  fullName: string;
};

export const Route = createFileRoute("/guidance")({
  validateSearch: (s: Record<string, unknown>) => ({
    career: typeof s.career === "string" ? s.career : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Career Guidance — CareerAI" },
      {
        name: "description",
        content:
          "Companies, mentors, courses and a personalised roadmap for each of your predicted careers.",
      },
      { property: "og:title", content: "Career Guidance — CareerAI" },
      { property: "og:description", content: "Everything you need to act on your career match." },
    ],
  }),
  component: Guidance,
});

const TABS = [
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "mentors", label: "Mentors", icon: Users },
  { id: "courses", label: "Courses", icon: GraduationCap },
  { id: "path", label: "Career Path", icon: RouteIcon },
] as const;

function Guidance() {
  const { career } = Route.useSearch();
  const careers = useCareers();
  const { savedCourses, toggleCourse, profile, completedSteps, toggleStep, authed } = useApp();

  const active = careers.find((c) => c.id === career) ?? careers[0];
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("companies");

  const [liveMentors, setLiveMentors] = useState<BackendMentor[]>([]);
  useEffect(() => {
    if (!authed) return;
    api
      .get<{ mentors: BackendMentor[] }>(`/mentors?career=${encodeURIComponent(active.title)}`)
      .then((res) => setLiveMentors(res.mentors))
      .catch(() => setLiveMentors([]));
  }, [authed, active.title]);

  return (
    <AppShell>
      <SectionTitle
        title="Career Guidance"
        subtitle="Deep-dive into each predicted career: who hires, who can mentor you, what to learn and in what order."
      />

      <div className="mb-6 flex flex-wrap gap-3">
        {careers.slice(0, 3).map((c) => (
          <Link
            key={c.id}
            to="/guidance"
            search={{ career: c.id }}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors",
              c.id === active.id
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            <span className="block text-[15px] font-semibold">{c.title}</span>
            <span className="block text-sm text-muted-foreground">{c.confidence}% match</span>
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{active.title}</h2>
            <p className="mt-1 text-muted-foreground">
              {active.salaryRange} · {active.demand} demand
            </p>
          </div>
          <div className="min-w-[200px]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-semibold">{active.confidence}%</span>
            </div>
            <ProgressBar
              value={active.confidence}
              tone={confidenceTone(active.confidence)}
              className="mt-2"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => downloadCareerReport(active, profile)}
            >
              <Download className="size-4" /> Download report
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-accent p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
            <Sparkles className="size-4" /> AI Summary
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-accent-foreground/85">
            {active.aiSummary}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {active.skillGaps.map((g) => (
            <div key={g.skill} className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>{g.skill}</span>
                <span>{g.match}%</span>
              </div>
              <ProgressBar value={g.match} tone={confidenceTone(g.match)} className="mt-2" />
              <p className="mt-2 text-xs text-muted-foreground">{g.note}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-[15px] font-medium transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "companies" && active.companies.length === 0 && (
          <Card>
            <p className="text-muted-foreground">
              No companies are curated for {active.title} yet. Try searching{" "}
              <a
                className="font-medium text-primary underline"
                href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(active.title)}`}
                target="_blank"
                rel="noreferrer"
              >
                LinkedIn Jobs
              </a>{" "}
              for live openings.
            </p>
          </Card>
        )}
        {tab === "companies" && active.companies.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {active.companies.map((co) => (
              <Card key={co.name}>
                <span
                  className="grid size-11 place-items-center rounded-xl text-base font-bold text-primary-foreground"
                  style={{ backgroundColor: `oklch(0.55 0.15 ${co.logoHue})` }}
                >
                  {co.name[0]}
                </span>
                <p className="mt-4 text-lg font-semibold">{co.name}</p>
                <p className="text-sm text-muted-foreground">{co.role}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{co.packageRange}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <Chip tone="success">{co.openRoles} open</Chip>
                  <span className="text-muted-foreground">{co.location}</span>
                </div>
                <JobOpenings company={co.name} role={co.role} />
              </Card>
            ))}
          </div>
        )}

        {tab === "mentors" && liveMentors.length === 0 && (
          <Card>
            <p className="text-muted-foreground">
              No mentors are tagged for {active.title} yet. Browse the full mentor directory on the{" "}
              <Link to="/mentorship" className="font-medium text-primary underline">
                Mentorship page
              </Link>{" "}
              instead — search by skill to find someone close to this path.
            </p>
          </Card>
        )}
        {tab === "mentors" && liveMentors.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {liveMentors.map((m) => (
              <Card key={m.id}>
                <div className="flex items-start gap-4">
                  <Avatar name={m.fullName} className="size-14 text-base" />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">{m.fullName}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.title ?? "Mentor"} {m.company ? `· ${m.company}` : ""}
                    </p>
                    {m.bio && (
                      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                        {m.bio}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.expertiseTags.map((e) => (
                        <Chip key={e} tone="neutral">
                          {e}
                        </Chip>
                      ))}
                    </div>
                    <Link to="/mentorship">
                      <Button size="sm" className="mt-4">
                        <CalendarPlus className="size-4" /> Request on Mentorship
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === "courses" && (
          <div className="grid gap-4 lg:grid-cols-3">
            {active.courses.map((c) => {
              const saved = savedCourses.includes(c.id);
              return (
                <Card key={c.id} className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <Chip tone="neutral">{c.level}</Chip>
                    <span className="text-sm text-muted-foreground">{c.duration}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{c.title}</h3>
                  <p className="text-sm text-muted-foreground">{c.provider}</p>
                  <p className="mt-3 flex-1 text-[15px] text-muted-foreground">{c.reason}</p>
                  <div className="mt-5 flex gap-2">
                    <Button
                      size="sm"
                      variant={saved ? "soft" : "primary"}
                      className="flex-1"
                      onClick={() => toggleCourse(c.id, c.title)}
                    >
                      {saved ? (
                        <BookmarkCheck className="size-4" />
                      ) : (
                        <Bookmark className="size-4" />
                      )}
                      {saved ? "Enrolled" : "Enroll"}
                    </Button>
                    <a href={c.url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" aria-label={`Open ${c.title}`}>
                        <ExternalLink className="size-4" />
                      </Button>
                    </a>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "path" && (
          <Card>
            <h3 className="text-xl font-semibold">Personalised path to {active.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Ticking a milestone here also ticks it on the{" "}
              <Link to="/career-path" className="font-medium text-primary underline">
                Career Path
              </Link>{" "}
              page - they're the same checklist.
            </p>
            <ol className="mt-6 space-y-6 border-l-2 border-border pl-6">
              {active.path.map((s, i) => {
                const key = `${active.id}:${s.phase}`;
                const done = completedSteps.includes(key);
                // First not-yet-done step is "in progress", everything after is "upcoming" -
                // derived from the shared completedSteps list instead of the static demo
                // status field, so this always matches what's checked on Career Path.
                const firstOpenIndex = active.path.findIndex(
                  (step) => !completedSteps.includes(`${active.id}:${step.phase}`),
                );
                const status = done ? "completed" : i === firstOpenIndex ? "in-progress" : "upcoming";
                return (
                  <li key={s.phase} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleStep(key)}
                      className="w-full text-left"
                    >
                      <span
                        className={cn(
                          "absolute -left-[31px] top-1 size-4 rounded-full border-2 border-background",
                          status === "completed"
                            ? "bg-success"
                            : status === "in-progress"
                              ? "bg-primary"
                              : "bg-border",
                        )}
                      />
                      <p className="text-xs font-semibold tracking-widest text-muted-foreground">
                        {s.phase.toUpperCase()}
                      </p>
                      <p className="mt-1 text-[17px] font-semibold">{s.title}</p>
                      <p className="mt-1 text-[15px] text-muted-foreground">{s.detail}</p>
                      <Chip
                        className="mt-2"
                        tone={status === "completed" ? "success" : status === "in-progress" ? "primary" : "neutral"}
                      >
                        {status.replace("-", " ")}
                      </Chip>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

      </div>
    </AppShell>
  );
}
