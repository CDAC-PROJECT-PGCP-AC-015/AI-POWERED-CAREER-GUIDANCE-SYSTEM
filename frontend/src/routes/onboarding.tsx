import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Lightbulb } from "lucide-react";
import { useState } from "react";
import { Button, Card, Field, ProgressBar, inputClass } from "@/components/ui-kit";
import { useApp } from "@/lib/app-store";
import { EDUCATION_LEVELS, SPECIALIZATION_SUGGESTIONS } from "@/lib/career-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Let's get to know you — CareerAI" },
      {
        name: "description",
        content:
          "Tell CareerAI about your academic standing so we can tailor your career pathways.",
      },
      { property: "og:title", content: "Pre-assessment — CareerAI" },
      { property: "og:description", content: "Three quick steps before your AI career interview." },
    ],
  }),
  component: Onboarding,
});

const YEARS = ["1st Year", "2nd Year", "3rd Year", "Final Year", "Post Graduate"];
const INTERESTS = [
  "Web Development",
  "Machine Learning",
  "Data Analysis",
  "Cloud & DevOps",
  "Cybersecurity",
  "Product Management",
  "Embedded Systems",
  "Mobile Apps",
  "UI/UX Design",
];
const GOALS = [
  "Product-based company",
  "Startup",
  "Higher studies",
  "Government / PSU",
  "Freelance",
];

/** 0-100 percentage marks, allowing one decimal place. */
function isValidPercent(v: string) {
  if (!v.trim()) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}
/** 0-10 CGPA, allowing decimals. */
function isValidCgpa(v: string) {
  if (!v.trim()) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 10;
}

function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding, logActivity } = useApp();

  const [step, setStep] = useState(0);
  const [stream, setStream] = useState("");
  const [year, setYear] = useState("");
  const [branch, setBranch] = useState("");
  const [marks10th, setMarks10th] = useState("");
  const [marks12th, setMarks12th] = useState("");
  const [graduationCgpa, setGraduationCgpa] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");

  const toggleInterest = (i: string) =>
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  function next() {
    if (step === 0) {
      if (!stream || !year || branch.trim().length < 2) {
        return setError("Please complete stream, year and specialization.");
      }
      if (!isValidPercent(marks10th) || !isValidPercent(marks12th)) {
        return setError("Enter valid 10th and 12th percentages (0–100).");
      }
      if (!isValidCgpa(graduationCgpa)) {
        return setError("Enter a valid graduation CGPA (0–10).");
      }
    }
    if (step === 1 && interests.length < 2) return setError("Pick at least two interests.");
    if (step === 2 && !goal) return setError("Choose the goal that fits you best.");
    setError("");

    if (step < 2) return setStep(step + 1);

    completeOnboarding({
      stream,
      year,
      branch: branch.trim(),
      interests: [...interests, goal],
      marks10thPercent: Number(marks10th),
      marks12thPercent: Number(marks12th),
      graduationCgpa: Number(graduationCgpa),
    });
    logActivity({
      kind: "system",
      title: "Profile completed",
      detail: `${branch.trim()}, ${year} — ${interests.length} interests selected.`,
    });
    navigate({ to: "/assessment" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link to="/" className="text-xl font-extrabold text-primary">
          CareerAI
        </Link>
        <Link
          to="/dashboard"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Save &amp; Exit
        </Link>
      </header>

      <div className="mx-auto grid max-w-5xl gap-0 px-4 py-12 lg:grid-cols-[1.2fr_1fr]">
        <Card className="rounded-b-none p-8 lg:rounded-l-2xl lg:rounded-br-none lg:rounded-tr-none">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-bold">
              {["Let's get to know you", "What excites you?", "Where are you heading?"][step]}
            </h1>
            <span className="whitespace-nowrap text-sm text-muted-foreground">{step + 1} of 3</span>
          </div>
          <ProgressBar value={((step + 1) / 3) * 100} className="mt-4" />
          <p className="mt-5 text-muted-foreground">
            {
              [
                "Tell us a bit about your current academic standing so we can tailor your pathways.",
                "Select the areas you naturally gravitate towards. Pick at least two.",
                "Your ambition shapes how we sequence your roadmap.",
              ][step]
            }
          </p>

          <div className="mt-7 space-y-5">
            {step === 0 && (
              <>
                <Field label="Academic Stream">
                  <select
                    className={inputClass}
                    value={stream}
                    onChange={(e) => setStream(e.target.value)}
                  >
                    <option value="">Select your stream...</option>
                    {EDUCATION_LEVELS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Year of Study">
                  <select
                    className={inputClass}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    <option value="">Select year...</option>
                    {YEARS.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Specialization / Branch">
                  <input
                    className={inputClass}
                    placeholder="e.g., Computer Science, Mechanical..."
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    list="specialization-suggestions"
                  />
                  <datalist id="specialization-suggestions">
                    {SPECIALIZATION_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="10th Marks (%)">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g., 88.5"
                      value={marks10th}
                      onChange={(e) => setMarks10th(e.target.value)}
                    />
                  </Field>
                  <Field label="12th Marks (%)">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      inputMode="decimal"
                      placeholder="e.g., 84.0"
                      value={marks12th}
                      onChange={(e) => setMarks12th(e.target.value)}
                    />
                  </Field>
                </div>
                <Field
                  label="Graduation CGPA"
                  hint={
                    <span className="text-xs font-normal text-muted-foreground">out of 10</span>
                  }
                >
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={10}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="e.g., 7.8"
                    value={graduationCgpa}
                    onChange={(e) => setGraduationCgpa(e.target.value)}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  These academic scores are fed directly into the prediction model alongside your
                  interview answers — accurate numbers sharpen your results.
                </p>
              </>
            )}

            {step === 1 && (
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => {
                  const on = interests.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleInterest(i)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-muted",
                      )}
                    >
                      {on && <Check className="size-4" />}
                      {i}
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                {GOALS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoal(g)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left text-[15px] font-medium transition-colors",
                      goal === g
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    {g}
                    {goal === g && <Check className="size-5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button onClick={next}>
              {step === 2 ? "Start Assessment" : "Continue"} <ArrowRight className="size-4" />
            </Button>
          </div>
        </Card>

        <div className="grid place-items-center rounded-b-2xl bg-accent p-8 lg:rounded-l-none lg:rounded-r-2xl">
          <div className="text-center">
            <span className="mx-auto mb-6 grid size-20 place-items-center rounded-2xl bg-card shadow-[var(--shadow-card)]">
              <Lightbulb className="size-9 text-primary" />
            </span>
            <h2 className="text-xl font-semibold text-accent-foreground">Why we ask this</h2>
            <p className="mt-3 text-sm leading-relaxed text-accent-foreground/80">
              Your stream, year and interests are fed straight into the prediction model as
              features. The more precise you are here, the sharper your top-3 career matches and
              their roadmaps become.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
