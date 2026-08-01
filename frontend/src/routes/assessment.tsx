import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, CircleDot, Mic, PauseCircle, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ProgressBar } from "@/components/ui-kit";
import { useApp } from "@/lib/app-store";
import { ASSESSMENT_AREAS, ASSESSMENT_QUESTIONS } from "@/lib/career-data";
import { assistantReply } from "@/lib/career.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assessment")({
  head: () => ({
    meta: [
      { title: "AI Career Assessment — CareerAI" },
      {
        name: "description",
        content:
          "A 15-question adaptive AI interview covering your skills, interests and career goals.",
      },
      { property: "og:title", content: "AI Career Assessment — CareerAI" },
      {
        property: "og:description",
        content: "Answer 15 questions and let the model map your career.",
      },
    ],
  }),
  component: Assessment,
});

type Msg = { role: "user" | "assistant"; content: string };

function Assessment() {
  const navigate = useNavigate();
  const { profile, setAnswers, logActivity, ensureAssessment, postMessage, completeAssessment } =
    useApp();
  const reply = useServerFn(assistantReply);

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Hello ${profile?.name?.split(" ")[0] ?? "there"}! I'm ready to begin your assessment. ${ASSESSMENT_QUESTIONS[0].text}`,
    },
  ]);
  const [answers, setLocalAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fire off the backend assessment record as soon as the interview opens —
    // this is what /predict and the mentor/admin dashboards key off later.
    ensureAssessment();
  }, [ensureAssessment]);

  const index = answers.length;
  const total = ASSESSMENT_QUESTIONS.length;
  const current = ASSESSMENT_QUESTIONS[Math.min(index, total - 1)];
  const done = index >= total;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    if (busy || done) return;
    const answer = text.trim();
    if (!answer) return;

    const nextAnswers = [...answers, { question: current.text, answer }];
    const history: Msg[] = [...messages, { role: "user", content: answer }];
    setMessages(history);
    setLocalAnswers(nextAnswers);
    setDraft("");
    setBusy(true);
    postMessage("user", answer);

    const nextQuestion =
      nextAnswers.length < total ? ASSESSMENT_QUESTIONS[nextAnswers.length].text : null;

    try {
      const res = await reply({ data: { history, nextQuestion } });
      setMessages((m) => [...m, { role: "assistant", content: res.message }]);
      postMessage("assistant", res.message);
    } catch {
      const fallback = nextQuestion ?? "Thanks — analysing your responses now.";
      setMessages((m) => [...m, { role: "assistant", content: fallback }]);
      postMessage("assistant", fallback);
    } finally {
      setBusy(false);
    }

    if (!nextQuestion) {
      setAnswers(nextAnswers);
      await completeAssessment();
      logActivity({
        kind: "assessment",
        title: "AI Career Assessment completed",
        detail: `${total} responses captured across ${ASSESSMENT_AREAS.length} assessment areas.`,
      });
      setTimeout(() => navigate({ to: "/analyzing" }), 1200);
    }
  }

  // Which assessment area is active, derived from question index
  let cursor = 0;
  const areaState = ASSESSMENT_AREAS.map((a) => {
    const start = cursor;
    cursor += a.questions;
    if (index >= cursor) return { ...a, state: "completed" as const };
    if (index >= start) return { ...a, state: "active" as const };
    return { ...a, state: "pending" as const };
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Link to="/dashboard" aria-label="Back to dashboard">
          <ArrowLeft className="size-5 text-muted-foreground" />
        </Link>
        <h1 className="text-lg font-bold sm:text-xl">AI Career Assessment</h1>
        <div className="ml-auto hidden items-center gap-3 text-sm md:flex">
          {["Interview", "Analysis", "Results"].map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-xs font-semibold",
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className={i === 0 ? "font-medium text-primary" : "text-muted-foreground"}>
                {s}
              </span>
              {i < 2 && <span className="h-px w-6 bg-border" />}
            </span>
          ))}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[320px] shrink-0 flex-col border-r border-border bg-card lg:flex">
          <div className="border-b border-border p-6">
            <p className="font-semibold">{profile?.name ?? "Guest Student"}</p>
            <p className="text-sm text-muted-foreground">
              {profile?.branch ? `${profile.branch} student` : "Engineering Student"}
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progress</span>
              <span className="font-semibold text-primary">
                {Math.min(index + (done ? 0 : 1), total)} of {total}
              </span>
            </div>
            <ProgressBar value={(index / total) * 100} className="mt-3" />

            <p className="mt-8 text-xs font-semibold tracking-widest text-muted-foreground">
              ASSESSMENT AREAS
            </p>
            <ul className="mt-4 space-y-4">
              {areaState.map((a) => (
                <li key={a.id} className="flex gap-3">
                  {a.state === "completed" ? (
                    <Check className="mt-0.5 size-5 text-success" />
                  ) : a.state === "active" ? (
                    <CircleDot className="mt-0.5 size-5 text-primary" />
                  ) : (
                    <span className="mt-1 size-4 rounded-full border-2 border-border" />
                  )}
                  <div>
                    <p
                      className={cn(
                        "text-[15px] font-medium",
                        a.state === "active" ? "text-primary" : "text-foreground",
                      )}
                    >
                      {a.label}
                    </p>
                    <p className="text-sm capitalize text-muted-foreground">
                      {a.state === "active" ? "In Progress" : a.state}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto border-t border-border p-6">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-sm font-medium text-destructive"
            >
              <PauseCircle className="size-4" /> Save &amp; Pause
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-8">
            <p className="text-center text-xs">
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                Today, {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </p>
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary">
                    <Sparkles className="size-4 text-primary-foreground" />
                  </span>
                )}
                <p
                  className={cn(
                    "max-w-[min(640px,80%)] rounded-xl px-4 py-3 text-[15px] leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  {m.content}
                </p>
              </div>
            ))}
            {busy && (
              <div className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary">
                  <Sparkles className="size-4 text-primary-foreground" />
                </span>
                <span className="flex items-center gap-1 rounded-xl bg-accent px-4 py-4">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="size-2 animate-bounce rounded-full bg-primary/60"
                      style={{ animationDelay: `${d * 120}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}
            {!busy && !done && (
              <div className="flex flex-wrap gap-2 pl-11">
                <Button size="sm" variant="soft" onClick={() => send("I'd like to skip this one.")}>
                  Skip this
                </Button>
                <Button
                  size="sm"
                  variant="soft"
                  onClick={() =>
                    setMessages((m) => [
                      ...m,
                      {
                        role: "assistant",
                        content: `Sure — to put it another way: ${current.text.replace(/\?$/, "")}? Answer with a concrete example if you can.`,
                      },
                    ])
                  }
                >
                  Clarify
                </Button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border bg-card px-4 py-4 sm:px-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25"
            >
              <Mic className="mb-2.5 ml-2 size-5 shrink-0 text-muted-foreground" />
              <textarea
                rows={1}
                maxLength={500}
                value={draft}
                disabled={done}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
                placeholder={done ? "Assessment complete" : "Type your answer here..."}
                className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted-foreground"
              />
              <Button
                type="submit"
                size="sm"
                className="mb-0.5 size-10 shrink-0 p-0"
                disabled={busy || done || !draft.trim()}
                aria-label="Send answer"
              >
                <Send className="size-4" />
              </Button>
            </form>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Be specific for better analysis</span>
              <span>{draft.length}/500</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
