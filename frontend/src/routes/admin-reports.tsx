import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Chip, ProgressBar, SectionTitle } from "@/components/ui-kit";
import { api } from "@/lib/api-client";
import { useApp } from "@/lib/app-store";

export const Route = createFileRoute("/admin-reports")({
  head: () => ({
    meta: [
      { title: "Reports — CareerAI Admin" },
      { name: "description", content: "Readiness distribution, career distribution and mentor-load reports for your institution." },
      { property: "og:title", content: "Reports — CareerAI Admin" },
      { property: "og:description", content: "Institution reporting and export." },
    ],
  }),
  component: AdminReports,
});

type AdminStudentRow = {
  id: string;
  name: string;
  email: string;
  assessment: "completed" | "in-progress" | "not-started";
  topCareer: string | null;
  confidence: number | null;
  readiness: number;
  mentor: string | null;
};
type CareerDistributionRow = { career: string; count: number; percent: number };
type AdminMentor = { id: string; fullName: string; pendingRequests: number };

function AdminReports() {
  const { authed, logActivity } = useApp();
  const [students, setStudents] = useState<AdminStudentRow[]>([]);
  const [distribution, setDistribution] = useState<CareerDistributionRow[]>([]);
  const [mentors, setMentors] = useState<AdminMentor[]>([]);

  useEffect(() => {
    if (!authed) return;
    Promise.all([
      api.get<{ students: AdminStudentRow[] }>("/admin/students"),
      api.get<{ distribution: CareerDistributionRow[] }>("/admin/career-distribution"),
      api.get<{ mentors: AdminMentor[] }>("/admin/mentors"),
    ]).then(([s, d, m]) => {
      setStudents(s.students);
      setDistribution(d.distribution);
      setMentors(m.mentors);
    });
  }, [authed]);

  const readinessBuckets = [
    { label: "On track (≥75% readiness)", value: students.filter((s) => s.readiness >= 75).length },
    { label: "In progress (25–74%)", value: students.filter((s) => s.readiness >= 25 && s.readiness < 75).length },
    { label: "Just starting (<25%)", value: students.filter((s) => s.readiness < 25).length },
  ];
  const total = students.length || 1;

  // Real, computed alerts instead of hand-authored fixtures: students who
  // finished their assessment but haven't started their roadmap, and
  // mentors sitting on a backlog of unanswered requests.
  const staleStudents = students.filter((s) => s.assessment === "completed" && s.readiness === 0);
  const overloadedMentors = mentors.filter((m) => m.pendingRequests >= 3);

  function exportCsv() {
    const header = "Name,Email,Predicted career,Confidence,Readiness,Assessment,Mentor";
    const body = students
      .map((s) => [s.name, s.email, s.topCareer ?? "", s.confidence ?? "", s.readiness, s.assessment, s.mentor ?? ""].join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`${header}\n${body}`], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "careerai-student-report.csv";
    a.click();
    URL.revokeObjectURL(url);
    logActivity({ kind: "system", title: "Student report exported", detail: "CSV of all students downloaded." });
  }

  return (
    <AppShell>
      <SectionTitle
        title="Reports"
        subtitle="Readiness and career distribution across every registered student — live from the database."
        action={
          <Button onClick={exportCsv} disabled={students.length === 0}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">Roadmap readiness</h2>
          <div className="mt-5 space-y-5">
            {readinessBuckets.map((b) => (
              <div key={b.label}>
                <div className="flex items-center justify-between text-[15px]">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-muted-foreground">{b.value} students</span>
                </div>
                <ProgressBar value={(b.value / total) * 100} tone="success" className="mt-2" />
              </div>
            ))}
            {students.length === 0 && (
              <p className="text-sm text-muted-foreground">No students yet.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Top predicted careers</h2>
          <div className="mt-5 space-y-5">
            {distribution.slice(0, 3).map((d) => (
              <div key={d.career}>
                <div className="flex items-center justify-between text-[15px]">
                  <span className="font-medium">{d.career}</span>
                  <span className="text-muted-foreground">{d.percent}%</span>
                </div>
                <ProgressBar value={d.percent} className="mt-2" />
              </div>
            ))}
            {distribution.length === 0 && (
              <p className="text-sm text-muted-foreground">No completed assessments yet.</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Alerts</h2>
        <ul className="mt-4 space-y-3">
          {overloadedMentors.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
              <Chip tone="warning">warning</Chip>
              <div className="min-w-0">
                <p className="font-medium">{m.fullName} has a request backlog</p>
                <p className="text-sm text-muted-foreground">{m.pendingRequests} pending session requests.</p>
              </div>
            </li>
          ))}
          {staleStudents.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
              <Chip tone="danger">attention</Chip>
              <div className="min-w-0">
                <p className="font-medium">{s.name} hasn't started their roadmap</p>
                <p className="text-sm text-muted-foreground">
                  Completed the assessment but hasn't checked off any milestones yet.
                </p>
              </div>
            </li>
          ))}
          {overloadedMentors.length === 0 && staleStudents.length === 0 && (
            <p className="text-sm text-muted-foreground">No alerts right now.</p>
          )}
        </ul>
      </Card>
    </AppShell>
  );
}
