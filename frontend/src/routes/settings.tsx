import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Field, SectionTitle, inputClass } from "@/components/ui-kit";
import { api, ApiError } from "@/lib/api-client";
import { useApp } from "@/lib/app-store";
import { EDUCATION_LEVELS, SPECIALIZATION_SUGGESTIONS } from "@/lib/career-data";

function isValidPercent(v: string) {
  if (!v.trim()) return true; // optional on the edit form — only validate if filled in
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100;
}
function isValidCgpa(v: string) {
  if (!v.trim()) return true;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 10;
}

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CareerAI" },
      {
        name: "description",
        content: "Update your profile details, change your password or sign out of CareerAI.",
      },
      { property: "og:title", content: "Settings — CareerAI" },
      { property: "og:description", content: "Manage your CareerAI account." },
    ],
  }),
  component: SettingsPage,
});

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change password. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold">Change password</h2>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <Field label="Current password">
          <input
            type="password"
            className={inputClass}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            className={inputClass}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            className={inputClass}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-success-foreground">Password changed.</p>}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Update password"}
        </Button>
      </form>
    </Card>
  );
}

function SettingsPage() {
  const { profile, completeOnboarding, resetJourney, signOut, logActivity } = useApp();
  const navigate = useNavigate();
  const role = profile?.role ?? "student";

  const [stream, setStream] = useState(profile?.stream ?? "");
  const [year, setYear] = useState(profile?.year ?? "");
  const [branch, setBranch] = useState(profile?.branch ?? "");
  const [marks10th, setMarks10th] = useState(profile?.marks10thPercent?.toString() ?? "");
  const [marks12th, setMarks12th] = useState(profile?.marks12thPercent?.toString() ?? "");
  const [graduationCgpa, setGraduationCgpa] = useState(profile?.graduationCgpa?.toString() ?? "");
  const [saved, setSaved] = useState(false);
  const [fieldError, setFieldError] = useState("");
  // True once a save has actually changed an academic field this session —
  // that's what should have retaking the assessment (a pure re-save of
  // unchanged values doesn't need a new prediction).
  const [showRetakePrompt, setShowRetakePrompt] = useState(false);

  function save() {
    setFieldError("");
    if (!isValidPercent(marks10th) || !isValidPercent(marks12th)) {
      return setFieldError("10th/12th marks must be a percentage between 0 and 100.");
    }
    if (!isValidCgpa(graduationCgpa)) {
      return setFieldError("Graduation CGPA must be between 0 and 10.");
    }

    const changed =
      stream !== (profile?.stream ?? "") ||
      branch !== (profile?.branch ?? "") ||
      marks10th !== (profile?.marks10thPercent?.toString() ?? "") ||
      marks12th !== (profile?.marks12thPercent?.toString() ?? "") ||
      graduationCgpa !== (profile?.graduationCgpa?.toString() ?? "");

    completeOnboarding({
      stream,
      year,
      branch,
      interests: profile?.interests ?? [],
      marks10thPercent: marks10th.trim() ? Number(marks10th) : undefined,
      marks12thPercent: marks12th.trim() ? Number(marks12th) : undefined,
      graduationCgpa: graduationCgpa.trim() ? Number(graduationCgpa) : undefined,
    });
    logActivity({ kind: "system", title: "Profile updated", detail: `${branch}, ${year}` });
    setSaved(true);
    setShowRetakePrompt(changed);
  }

  return (
    <AppShell>
      <SectionTitle
        title="Settings"
        subtitle={
          role === "student"
            ? "Your profile drives every prediction on the platform."
            : "Manage your account."
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">Profile</h2>
          <div className="mt-5 space-y-4">
            <Field label="Name">
              <input className={inputClass} value={profile?.name ?? ""} readOnly />
            </Field>
            <Field label="Email">
              <input className={inputClass} value={profile?.email ?? ""} readOnly />
            </Field>
            {/* Academic fields only make sense for students — mentors edit
                their public listing on the Mentor Dashboard instead, and
                admins have no academic profile at all. */}
            {role === "student" && (
              <>
                <Field label="Academic stream">
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
                <Field label="Year of study">
                  <input
                    className={inputClass}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </Field>
                <Field label="Specialization">
                  <input
                    className={inputClass}
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    list="specialization-suggestions-settings"
                  />
                  <datalist id="specialization-suggestions-settings">
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
                    value={graduationCgpa}
                    onChange={(e) => setGraduationCgpa(e.target.value)}
                  />
                </Field>

                {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
                <Button onClick={save}>Save changes</Button>
                {saved && !showRetakePrompt && (
                  <p className="text-sm text-success-foreground">Profile saved.</p>
                )}

                {showRetakePrompt && (
                  <div className="rounded-xl border border-primary/30 bg-accent p-4">
                    <p className="text-sm font-medium text-accent-foreground">
                      Profile saved. Since your academic details changed, your existing career
                      predictions may be out of date.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          resetJourney();
                          logActivity({
                            kind: "system",
                            title: "Reassessment started",
                            detail: "Profile details changed — retaking the assessment.",
                          });
                          navigate({ to: "/assessment" });
                        }}
                      >
                        Retake assessment now
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowRetakePrompt(false)}>
                        Not now
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        <ChangePasswordCard />

        <Card>
          <h2 className="text-xl font-semibold">Danger zone</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {role === "student" && (
              <Button
                variant="outline"
                onClick={() => {
                  resetJourney();
                  logActivity({
                    kind: "system",
                    title: "Journey reset",
                    detail: "Assessment and predictions cleared.",
                  });
                  navigate({ to: "/assessment" });
                }}
              >
                Reset journey
              </Button>
            )}
            <Button
              variant="danger"
              onClick={() => {
                signOut();
                navigate({ to: "/" });
              }}
            >
              Sign out
            </Button>
          </div>
          {role === "student" && (
            <p className="mt-3 text-sm text-muted-foreground">
              Resetting clears your assessment answers, predictions and roadmap progress. Your
              profile stays.
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
