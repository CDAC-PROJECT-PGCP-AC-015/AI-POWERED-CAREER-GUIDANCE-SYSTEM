import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Search, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MessageThread } from "@/components/MessageThread";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ProgressBar,
  SectionTitle,
  confidenceTone,
  inputClass,
} from "@/components/ui-kit";
import { api } from "@/lib/api-client";
import { useApp } from "@/lib/app-store";

export const Route = createFileRoute("/mentor-students")({
  head: () => ({
    meta: [
      { title: "My Students — CareerAI Mentor" },
      {
        name: "description",
        content: "Students who requested you, filtered to those who've completed their assessment.",
      },
      { property: "og:title", content: "My Students — CareerAI Mentor" },
      { property: "og:description", content: "Track the mentees assigned to you." },
    ],
  }),
  component: MentorStudents,
});

type MyStudent = {
  id: string;
  name: string;
  email: string;
  topCareer: string | null;
  confidence: number | null;
  readiness: number;
  connectionId: string | null;
  connectionStatus: string | null;
};

function MentorStudents() {
  const { authed } = useApp();
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<MyStudent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    api
      .get<{ students: MyStudent[] }>("/connections/students")
      .then((res) => setStudents(res.students))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load students"));
  }, [authed]);

  const rows = useMemo(() => {
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return students;
    return students.filter((s) => {
      const haystack = `${s.name} ${s.email} ${s.topCareer ?? ""}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [students, q]);

  return (
    <AppShell>
      <SectionTitle
        title="My Students"
        subtitle="Everyone who has requested a session with you AND completed their assessment."
      />

      {error && (
        <Card className="mb-6">
          <p className="text-destructive">{error}</p>
        </Card>
      )}

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className={`${inputClass} pl-11`}
          placeholder="Search by name or career"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start gap-3">
              <Avatar name={s.name} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{s.name}</p>
                <p className="truncate text-sm text-muted-foreground">{s.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.topCareer && <Chip tone="primary">{s.topCareer}</Chip>}
                  {s.confidence != null && (
                    <Chip tone={confidenceTone(s.confidence)}>
                      <TrendingUp className="size-3" /> {s.confidence}% match
                    </Chip>
                  )}
                  {s.connectionStatus && <Chip tone="neutral">{s.connectionStatus}</Chip>}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Roadmap readiness</span>
                <span className="font-medium">{s.readiness}%</span>
              </div>
              <ProgressBar value={s.readiness} tone={confidenceTone(s.readiness)} className="mt-2" />
            </div>
            {s.connectionId && s.connectionStatus === "accepted" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setOpenThread(openThread === s.connectionId ? null : s.connectionId)}
                >
                  <MessageCircle className="size-4" />
                  {openThread === s.connectionId ? "Hide conversation" : "Message student"}
                </Button>
                {openThread === s.connectionId && (
                  <MessageThread connectionId={s.connectionId} otherPartyName={s.name} />
                )}
              </>
            )}
            {s.connectionId && s.connectionStatus !== "accepted" && (
              <p className="mt-4 text-xs text-muted-foreground">
                Messaging unlocks once you accept their session request (see Sessions).
              </p>
            )}
          </Card>
        ))}
      </div>
      {rows.length === 0 && (
        <p className="text-muted-foreground">
          {authed
            ? "No students yet — this fills in once a student requests a session with you and has completed their assessment."
            : "Sign in as a mentor to see your students."}
        </p>
      )}
    </AppShell>
  );
}
