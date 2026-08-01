import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, GraduationCap, RefreshCw, ShieldPlus, TrendingUp, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Chip, Field, ProgressBar, SectionTitle, inputClass } from "@/components/ui-kit";
import { api, ApiError } from "@/lib/api-client";
import { useApp } from "@/lib/app-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Institution Admin — CareerAI" },
      {
        name: "description",
        content: "Live view of assessment completion, predicted careers and mentor coverage.",
      },
      { property: "og:title", content: "Institution Admin — CareerAI" },
      { property: "og:description", content: "Track real student and mentor activity." },
    ],
  }),
  component: Admin,
});

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};
type AdminStats = {
  totalStudents: number;
  totalMentors: number;
  assessmentsCompleted: number;
  activeMentors: number;
  avgTopMatch: number;
};
type SystemLogRow = {
  id: number;
  userId: string | null;
  eventType: string;
  details: unknown;
  createdAt: string;
};
type CareerDistributionRow = { career: string; count: number; percent: number };
type AdminMentor = {
  id: string;
  fullName: string;
  title: string | null;
  company: string | null;
  isActive: boolean;
  totalRequests: number;
  pendingRequests: number;
};

function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "mentor" | "student">("admin");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await api.post("/admin/users", { fullName, email, password, role });
      setSuccess(true);
      setFullName("");
      setEmail("");
      setPassword("");
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <ShieldPlus className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Create account</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        This is the only way to create another admin account — public sign-up only allows
        student/mentor, on purpose.
      </p>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Full name">
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Temporary password">
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        <Field label="Role">
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="admin">Admin</option>
            <option value="mentor">Mentor</option>
            <option value="student">Student</option>
          </select>
        </Field>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving}>
            <UserPlus className="size-4" /> {saving ? "Creating…" : "Create account"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-success-foreground">Account created.</p>}
        </div>
      </form>
    </Card>
  );
}

function Admin() {
  const { authed } = useApp();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<SystemLogRow[]>([]);
  const [distribution, setDistribution] = useState<CareerDistributionRow[]>([]);
  const [mentors, setMentors] = useState<AdminMentor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!authed) return;
    setLoading(true);
    Promise.all([
      api.get<{ users: AdminUser[] }>("/admin/users"),
      api.get<AdminStats>("/admin/stats"),
      api.get<{ logs: SystemLogRow[] }>("/admin/logs?take=12"),
      api.get<{ distribution: CareerDistributionRow[] }>("/admin/career-distribution"),
      api.get<{ mentors: AdminMentor[] }>("/admin/mentors"),
    ])
      .then(([u, s, l, d, m]) => {
        setUsers(u.users);
        setStats(s);
        setLogs(l.logs);
        setDistribution(d.distribution);
        setMentors(m.mentors);
        setError(null);
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? `${err.message} — is the signed-in account an admin, and is the backend running?`
            : "Could not reach the backend",
        ),
      )
      .finally(() => setLoading(false));
  }, [authed]);

  useEffect(refresh, [refresh]);
  useEffect(() => {
    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  async function promoteToAdmin(id: string) {
    setPromoting(id);
    try {
      await api.patch(`/admin/users/${id}`, { role: "admin" });
      refresh();
    } finally {
      setPromoting(null);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setPromoting(id);
    try {
      await api.patch(`/admin/users/${id}`, { isActive: !isActive });
      refresh();
    } finally {
      setPromoting(null);
    }
  }

  const headline = [
    { label: "Students", value: stats?.totalStudents ?? "—", icon: Users },
    { label: "Assessments completed", value: stats?.assessmentsCompleted ?? "—", icon: GraduationCap },
    { label: "Active mentors", value: stats?.activeMentors ?? "—", icon: BarChart3 },
    {
      label: "Avg. top match",
      value: stats ? `${stats.avgTopMatch}%` : "—",
      icon: TrendingUp,
    },
  ];

  return (
    <AppShell>
      <SectionTitle
        title="Institution Admin"
        subtitle="Live insight into assessment completion, predicted careers and mentor coverage — no demo data."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={() => setShowCreateForm((v) => !v)}>
              <UserPlus className="size-4" /> Create account
            </Button>
            <Link to="/admin-students">
              <Button variant="outline">View students</Button>
            </Link>
            <Link to="/admin-reports">
              <Button>Reports</Button>
            </Link>
          </div>
        }
      />

      {showCreateForm && (
        <div className="mb-6">
          <CreateAccountForm
            onCreated={() => {
              refresh();
              setShowCreateForm(false);
            }}
          />
        </div>
      )}

      {!authed && (
        <Card className="mb-6">
          <p className="text-muted-foreground">
            Sign in with an admin account to load real user/stats/log data from the backend. The
            seed script creates <code>admin@cdac.demo</code> / <code>Password123!</code> (see{" "}
            <code>backend/src/seed/seed.ts</code>).
          </p>
        </Card>
      )}
      {error && (
        <Card className="mb-6">
          <p className="text-destructive">{error}</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {headline.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <Icon className="size-5 text-primary" />
            </div>
            <p className="mt-3 text-3xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">Predicted career distribution</h2>
          <p className="text-xs text-muted-foreground">
            Real share of each student's #1 predicted career, computed from career_results.
          </p>
          <div className="mt-5 space-y-5">
            {distribution.slice(0, 6).map((d) => (
              <div key={d.career}>
                <div className="flex items-center justify-between text-[15px]">
                  <span className="font-medium">{d.career}</span>
                  <span className="text-muted-foreground">
                    {d.percent}% ({d.count})
                  </span>
                </div>
                <ProgressBar value={d.percent} className="mt-2" />
              </div>
            ))}
            {distribution.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No completed assessments yet — this fills in once students finish onboarding.
              </p>
            )}
          </div>
        </Card>

        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between p-6 pb-0">
            <h2 className="text-xl font-semibold">Mentors</h2>
            <span className="text-xs text-muted-foreground">live from backend</span>
          </div>
          <table className="mt-4 w-full min-w-[420px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Mentor</th>
                <th className="px-6 py-3 font-medium">Requests</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mentors.slice(0, 8).map((m) => (
                <tr key={m.id}>
                  <td className="px-6 py-3">
                    <p className="font-medium text-foreground">{m.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.title ?? "Mentor"} {m.company ? `· ${m.company}` : ""}
                    </p>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {m.totalRequests} ({m.pendingRequests} pending)
                  </td>
                  <td className="px-6 py-3">
                    <Chip tone={m.isActive ? "success" : "danger"}>
                      {m.isActive ? "active" : "suspended"}
                    </Chip>
                  </td>
                </tr>
              ))}
              {mentors.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={3}>
                    {authed ? "No mentors yet — run the seed script." : "Sign in as admin to load this."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-x-auto p-0">
          <div className="flex items-center justify-between p-6 pb-0">
            <h2 className="text-xl font-semibold">Recent Users</h2>
            <span className="text-xs text-muted-foreground">live from backend</span>
          </div>
          <table className="mt-4 w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Joined</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-3">
                    <p className="font-medium text-foreground">{u.fullName}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-6 py-3 capitalize text-muted-foreground">{u.role}</td>
                  <td className="px-6 py-3">
                    <Chip tone={u.isActive ? "success" : "danger"}>
                      {u.isActive ? "active" : "suspended"}
                    </Chip>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {u.role !== "admin" && (
                        <button
                          type="button"
                          onClick={() => promoteToAdmin(u.id)}
                          disabled={promoting === u.id}
                          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                        >
                          Make admin
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleActive(u.id, u.isActive)}
                        disabled={promoting === u.id}
                        className="text-xs font-medium text-muted-foreground hover:text-destructive hover:underline disabled:opacity-50"
                      >
                        {promoting === u.id ? "Working…" : u.isActive ? "Suspend" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={5}>
                    {authed ? "No users yet." : "Sign in as admin to load this."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card className="flex flex-col overflow-hidden p-0">
          <div className="flex items-center gap-2 p-6 pb-0">
            <Activity className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">System Log</h2>
          </div>
          <p className="px-6 pt-1 text-xs text-muted-foreground">
            Live from <code>l_system_logs</code> — register/login/prediction/session events,
            real-time.
          </p>
          <pre className="mt-4 flex-1 overflow-y-auto bg-[#0b1220] p-4 font-mono text-[11px] leading-relaxed text-emerald-300">
            {logs.length > 0
              ? logs
                  .map(
                    (l) =>
                      `[${new Date(l.createdAt).toISOString()}] ${l.eventType} ${JSON.stringify(l.details)}`,
                  )
                  .join("\n")
              : authed
                ? "No events yet."
                : "Sign in as admin to stream this."}
          </pre>
        </Card>
      </div>
    </AppShell>
  );
}
