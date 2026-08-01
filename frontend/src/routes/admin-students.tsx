import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Chip, ProgressBar, SectionTitle, confidenceTone, inputClass } from "@/components/ui-kit";
import { api } from "@/lib/api-client";
import { useApp } from "@/lib/app-store";

export const Route = createFileRoute("/admin-students")({
  head: () => ({
    meta: [
      { title: "Students — CareerAI Admin" },
      { name: "description", content: "Directory of every registered student with assessment status, predicted career and assigned mentor." },
      { property: "og:title", content: "Students — CareerAI Admin" },
      { property: "og:description", content: "Institution-wide student directory." },
    ],
  }),
  component: AdminStudents,
});

const STATUS_TONE = {
  completed: "success",
  "in-progress": "warning",
  "not-started": "danger",
} as const;

type AdminStudentRow = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  assessment: "completed" | "in-progress" | "not-started";
  topCareer: string | null;
  confidence: number | null;
  readiness: number;
  mentor: string | null;
};

function AdminStudents() {
  const { authed } = useApp();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminStudentRow["assessment"]>("all");
  const [students, setStudents] = useState<AdminStudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!authed) return;
    setLoading(true);
    api
      .get<{ students: AdminStudentRow[] }>("/admin/students")
      .then((res) => {
        setStudents(res.students);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load students"))
      .finally(() => setLoading(false));
  }, [authed]);

  useEffect(refresh, [refresh]);
  // Re-check for newly-registered students whenever the admin tabs back into
  // this page, without needing a full reload.
  useEffect(() => {
    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  // No institution/cohort concept exists in the schema — this is every
  // registered student, filterable by real assessment progress instead of
  // a fake "CDAC batch" grouping.
  const rows = useMemo(() => {
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return students.filter((s) => {
      if (statusFilter !== "all" && s.assessment !== statusFilter) return false;
      if (words.length === 0) return true;
      const haystack = `${s.name} ${s.email} ${s.topCareer ?? ""} ${s.mentor ?? ""}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [students, q, statusFilter]);

  return (
    <AppShell>
      <SectionTitle
        title="Students"
        subtitle="Every registered student, their predicted career and readiness — live from the database."
        action={
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      {!authed && (
        <Card className="mb-6">
          <p className="text-muted-foreground">Sign in with an admin account to load student data.</p>
        </Card>
      )}
      {error && (
        <Card className="mb-6">
          <p className="text-destructive">{error}</p>
        </Card>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputClass} pl-11`}
            placeholder="Search students, careers or mentors"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className={`${inputClass} sm:max-w-xs`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">All assessment statuses</option>
          <option value="completed">Completed</option>
          <option value="in-progress">In progress</option>
          <option value="not-started">Not started</option>
        </select>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-6 py-4 font-medium">Student</th>
              <th className="px-6 py-4 font-medium">Predicted career</th>
              <th className="px-6 py-4 font-medium">Assessment</th>
              <th className="px-6 py-4 font-medium">Readiness</th>
              <th className="px-6 py-4 font-medium">Mentor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="px-6 py-4">
                  <p className="font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </td>
                <td className="px-6 py-4">
                  {s.topCareer ?? <span className="text-muted-foreground">—</span>}
                  {s.confidence != null && (
                    <span className="ml-2 text-xs text-muted-foreground">{s.confidence}%</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <Chip tone={STATUS_TONE[s.assessment]}>{s.assessment}</Chip>
                </td>
                <td className="px-6 py-4">
                  <div className="w-28">
                    <ProgressBar value={s.readiness} tone={confidenceTone(s.readiness)} />
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">{s.mentor ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-6 py-8 text-muted-foreground">
            {authed ? "No students match those filters." : "Sign in as admin to load this."}
          </p>
        )}
      </Card>
    </AppShell>
  );
}
