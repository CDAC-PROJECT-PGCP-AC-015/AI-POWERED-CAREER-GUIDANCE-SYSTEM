import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  GraduationCap,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
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
import { useApp, useCareers } from "@/lib/app-store";
import { JobOpenings } from "@/components/JobOpenings";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Student Dashboard — CareerAI" },
      { name: "description", content: "Track your career readiness, top matches, mentor sessions and recommended courses in one place." },
      { property: "og:title", content: "Student Dashboard — CareerAI" },
      { property: "og:description", content: "Your CareerAI progress at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, activity, sessions, savedCourses, answers, predictions } = useApp();
  const careers = useCareers();
  const top = careers[0];

  const readiness = Math.round(
    ((answers.length ? 40 : 0) +
      (predictions ? 25 : 0) +
      Math.min(savedCourses.length * 5, 20) +
      Math.min(sessions.length * 5, 15)) *
      1,
  );

  const stats = [
    { label: "Career readiness", value: `${readiness}%`, icon: Target, hint: "Complete more steps to raise this" },
    { label: "Top match", value: top ? `${top.confidence}%` : "—", icon: TrendingUp, hint: top?.title ?? "Take the assessment" },
    { label: "Courses enrolled", value: String(savedCourses.length), icon: GraduationCap, hint: "From your Skill Lab" },
    { label: "Mentor sessions", value: String(sessions.length), icon: CalendarCheck, hint: "Requested or confirmed" },
  ];

  return (
    <AppShell>
      <SectionTitle
        title={`Welcome back, ${profile?.name?.split(" ")[0] ?? "Student"}`}
        subtitle={
          predictions
            ? "Here's where your career journey stands today."
            : "You're seeing demo predictions — take the assessment for your own results."
        }
        action={
          <Link to={predictions ? "/results" : "/assessment"}>
            <Button>
              {predictions ? "View results" : "Take assessment"} <ArrowRight className="size-4" />
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint }) => (
          <Card key={label}>
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <Icon className="size-5 text-primary" />
            </div>
            <p className="mt-3 text-3xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Top career matches</h2>
            <Link to="/results" className="text-sm font-medium text-primary">
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-5">
            {careers.slice(0, 3).map((c) => (
              <div key={c.id}>
                <div className="flex items-center justify-between gap-4">
                  <Link
                    to="/guidance"
                    search={{ career: c.id }}
                    className="font-medium hover:text-primary"
                  >
                    {c.title}
                  </Link>
                  <span className="text-sm font-semibold text-muted-foreground">{c.confidence}%</span>
                </div>
                <ProgressBar value={c.confidence} tone={confidenceTone(c.confidence)} className="mt-2" />
                <p className="mt-2 text-sm text-muted-foreground">{c.blurb}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">AI summary</h2>
          <p className="mt-1 text-sm text-muted-foreground">For your strongest match</p>
          <div className="mt-4 rounded-xl bg-accent p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
              <Sparkles className="size-4" /> {top?.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-accent-foreground/85">{top?.aiSummary}</p>
          </div>
          <Link to="/career-path" className="mt-5 block">
            <Button variant="outline" className="w-full">
              Open career path <ArrowRight className="size-4" />
            </Button>
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">Recommended mentors</h2>
          <div className="mt-4 space-y-4">
            {top?.mentors.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {m.title} · {m.company}
                  </p>
                </div>
                <Chip tone="success">{m.match}% match</Chip>
              </div>
            ))}
          </div>
          <Link to="/mentorship" className="mt-5 block">
            <Button variant="outline" className="w-full">
              Browse all mentors
            </Button>
          </Link>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Nothing yet. Your assessments, sessions and enrolments will appear here.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {activity.slice(0, 5).map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-[15px] font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{a.detail}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(a.at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/activity" className="mt-5 block">
            <Button variant="outline" className="w-full">
              View full activity
            </Button>
          </Link>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Companies hiring for {top?.title}</h2>
          <Building2 className="size-5 text-primary" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {top?.companies.map((co) => (
            <div key={co.name} className="rounded-xl border border-border p-4">
              <span
                className="grid size-10 place-items-center rounded-lg text-sm font-bold text-primary-foreground"
                style={{ backgroundColor: `oklch(0.55 0.15 ${co.logoHue})` }}
              >
                {co.name[0]}
              </span>
              <p className="mt-3 font-semibold">{co.name}</p>
              <p className="text-sm text-muted-foreground">{co.role}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {co.openRoles} open roles · {co.location}
              </p>
              <JobOpenings company={co.name} role={co.role} />
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
