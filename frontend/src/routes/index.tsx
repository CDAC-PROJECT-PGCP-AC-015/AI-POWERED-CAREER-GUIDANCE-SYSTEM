import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  GraduationCap,
  MessagesSquare,
  PlayCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import heroImage from "@/assets/hero-careerai.jpg";
import { Button, Card, Chip, ProgressBar } from "@/components/ui-kit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareerAI — Discover Your Perfect Career with AI" },
      {
        name: "description",
        content:
          "Answer 15 questions and get your top 3 predicted careers with AI summaries, top hiring companies, mentors, courses and a personalised roadmap.",
      },
      { property: "og:title", content: "CareerAI — Discover Your Perfect Career with AI" },
      {
        property: "og:description",
        content: "Built for C-DAC Bangalore students. Your personalised career roadmap in minutes.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "AI Interview",
    body: "Practice with our context-aware AI. Get real-time feedback on tone, technical accuracy and delivery before the real thing.",
  },
  {
    icon: BrainCircuit,
    title: "ML Prediction",
    body: "Our machine learning model analyses your skills against thousands of job profiles to predict your highest-probability career matches.",
  },
  {
    icon: GraduationCap,
    title: "Expert Mentors",
    body: "Connect with industry veterans who have navigated the exact paths you are exploring. Real advice from real professionals.",
  },
];

const STEPS = [
  { n: "01", title: "Tell us about you", body: "Three quick questions on your stream, year and interests." },
  { n: "02", title: "Take the AI interview", body: "15 adaptive questions across skills, interests and goals." },
  { n: "03", title: "Get your roadmap", body: "Top 3 careers with companies, mentors, courses and a month-by-month plan." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-primary">
            <Sparkles className="size-5" />
            CareerAI
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-foreground md:flex">
            <a href="#features" className="hover:text-primary">Features</a>
            <a href="#how" className="hover:text-primary">How It Works</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth" search={{ mode: "login" }} className="text-sm font-medium text-primary">
              Login
            </Link>
            <Link to="/auth" search={{ mode: "register" }}>
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-gradient relative overflow-hidden px-6 pt-16 pb-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="relative mx-auto max-w-3xl text-center">
            <Chip className="mb-6">Built for C-DAC Bangalore Students</Chip>
            <h1 className="text-4xl font-extrabold leading-tight text-foreground sm:text-6xl">
              Discover Your Perfect Career with AI
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Answer 15 questions. Get your personalised career roadmap in minutes.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/onboarding">
                <Button size="lg">
                  Start Free Assessment <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline">
                  <PlayCircle className="size-4" /> View Demo Dashboard
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              1,200+ C-DAC students have found their path
            </p>
          </div>

          <div className="relative mx-auto mt-14 max-w-5xl">
            <Card className="absolute -left-2 top-8 z-10 hidden w-60 p-4 shadow-[var(--shadow-float)] lg:block">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" />
                <span className="text-sm font-medium">Data Scientist Match</span>
              </div>
              <ProgressBar value={76} tone="success" className="mt-3" />
            </Card>
            <Card className="absolute -right-2 bottom-10 z-10 hidden w-56 p-4 shadow-[var(--shadow-float)] lg:block">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                <span className="text-sm font-medium">Interview Score</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-primary">87%</p>
            </Card>
            <img
              src={heroImage}
              alt="Students exploring AI career dashboards"
              width={1600}
              height={900}
              className="w-full rounded-2xl border border-border shadow-[var(--shadow-float)]"
            />
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Powered by Intelligence</h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to navigate your career journey.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <Card key={title}>
                <span className="mb-5 grid size-12 place-items-center rounded-xl bg-accent">
                  <Icon className="size-6 text-primary" />
                </span>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-border bg-muted/40 px-6 py-20">
        <div className="mx-auto max-w-[1280px]">
          <h2 className="text-center text-3xl font-bold sm:text-4xl">How It Works</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <Card key={s.n} className="bg-card">
                <span className="text-sm font-semibold tracking-widest text-primary">{s.n}</span>
                <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-[15px] text-muted-foreground">{s.body}</p>
              </Card>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link to="/onboarding">
              <Button size="lg">
                Start Free Assessment <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="text-lg font-extrabold text-primary">CareerAI</span>
          <div className="flex flex-wrap gap-5">
            <Link to="/help" className="hover:text-primary">Support</Link>
            <Link to="/mentor-portal" className="hover:text-primary">For Mentors</Link>
            <Link to="/admin" className="hover:text-primary">For Institutions</Link>
          </div>
          <span>© {new Date().getFullYear()} CareerAI Platform. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
