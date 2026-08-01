import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarCheck, MessageSquare, Plus, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Button, Card, Chip, Field, SectionTitle, inputClass } from "@/components/ui-kit";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/app-store";

export const Route = createFileRoute("/mentor-portal")({
  head: () => ({
    meta: [
      { title: "Mentor Portal — CareerAI" },
      {
        name: "description",
        content:
          "Manage your mentoring profile and review incoming session requests from students.",
      },
      { property: "og:title", content: "Mentor Portal — CareerAI" },
      {
        property: "og:description",
        content: "Guide C-DAC students through their first career move.",
      },
    ],
  }),
  component: MentorPortal,
});

function MentorPortal() {
  const {
    sessions,
    profile,
    mentorProfile,
    updateMentorProfile,
    loadMentorProfile,
    loadSessions,
    logActivity,
    confirmSession,
    declineSession,
  } = useApp();

  const [draft, setDraft] = useState(mentorProfile);
  const [expertiseInput, setExpertiseInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMentorProfile();
    loadSessions();
  }, [loadMentorProfile, loadSessions]);

  useEffect(() => setDraft(mentorProfile), [mentorProfile]);

  const name = profile?.name ?? "Mentor";

  function addExpertise() {
    const value = expertiseInput.trim();
    if (value && !draft.expertiseTags.includes(value)) {
      setDraft((d) => ({ ...d, expertiseTags: [...d.expertiseTags, value] }));
    }
    setExpertiseInput("");
  }

  function removeExpertise(tag: string) {
    setDraft((d) => ({ ...d, expertiseTags: d.expertiseTags.filter((e) => e !== tag) }));
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await updateMentorProfile({
        title: draft.title,
        company: draft.company,
        expertiseTags: draft.expertiseTags,
        bio: draft.bio,
        linkedinUrl: draft.linkedinUrl,
        availability: draft.availability,
      });
      logActivity({
        kind: "system",
        title: "Mentor profile updated",
        detail: "Your public mentor listing was saved.",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.warn("[mentor profile] save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  const pending = sessions.filter((s) => s.status === "pending");

  const stats = [
    { label: "Session requests", value: sessions.length, icon: CalendarCheck },
    { label: "Expertise tags", value: draft.expertiseTags.length, icon: Users },
    { label: "Replies pending", value: pending.length, icon: MessageSquare },
  ];

  return (
    <AppShell>
      <SectionTitle
        title={`Mentor Portal${profile?.name ? ` — ${profile.name}` : ""}`}
        subtitle="Manage your mentorship profile and availability."
        action={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Chip tone={draft.availability ? "success" : "neutral"}>
              {draft.availability ? "Available" : "Unavailable"}
            </Chip>
            <div className="flex gap-2">
              <Link to="/mentor-students">
                <Button variant="outline">My students</Button>
              </Link>
              <Link to="/mentor-sessions">
                <Button>Sessions</Button>
              </Link>
            </div>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <Icon className="size-5 text-primary" />
            </div>
            <p className="mt-3 text-3xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Edit Profile</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Available for sessions</span>
              <Switch
                checked={draft.availability}
                onCheckedChange={(checked) => setDraft((d) => ({ ...d, availability: checked }))}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full Title">
              <input
                className={inputClass}
                placeholder="Senior Machine Learning Engineer"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              />
            </Field>
            <Field label="Company">
              <input
                className={inputClass}
                placeholder="Tech Innovations Inc."
                value={draft.company}
                onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
              />
            </Field>
          </div>

          <Field
            label="Expertise (comma or Enter to add)"
            hint={
              <span className="font-normal text-muted-foreground">
                {draft.expertiseTags.length} tags
              </span>
            }
          >
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="Machine Learning, Python, Data Architecture"
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addExpertise();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addExpertise}>
                <Plus className="size-4" />
              </Button>
            </div>
            {draft.expertiseTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.expertiseTags.map((tag) => (
                  <Chip key={tag} tone="neutral" className="pr-1.5">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeExpertise(tag)}
                      className="ml-1 rounded-full p-0.5 hover:bg-background/60"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Chip>
                ))}
              </div>
            )}
          </Field>

          <div className="mt-4">
            <Field label="Professional Bio">
              <textarea
                className={`${inputClass} min-h-[110px] resize-y`}
                placeholder="I specialize in scaling ML models for enterprise applications. Always happy to review resumes or run mock technical interviews."
                value={draft.bio}
                onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="LinkedIn URL">
              <input
                className={inputClass}
                placeholder="https://linkedin.com/in/example"
                value={draft.linkedinUrl}
                onChange={(e) => setDraft((d) => ({ ...d, linkedinUrl: e.target.value }))}
              />
            </Field>
          </div>

          <Button className="mt-6 w-full" onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save Profile"}
          </Button>
        </Card>

        <Card>
          <p className="text-sm font-medium text-muted-foreground">Live Preview</p>
          <div className="mt-4 rounded-xl bg-accent p-5">
            {draft.availability && (
              <Chip tone="success" className="mb-3">
                <BadgeCheck className="size-3.5" /> Top Mentor
              </Chip>
            )}
            <div className="flex items-center gap-3">
              <Avatar name={name} className="size-14 text-base" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-accent-foreground">{name}</p>
                <p className="truncate text-sm text-accent-foreground/80">
                  {draft.title || "Your title"}
                  {draft.company ? ` at ${draft.company}` : ""}
                </p>
              </div>
            </div>
            {draft.expertiseTags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {draft.expertiseTags.map((tag) => (
                  <Chip key={tag} tone="neutral">
                    {tag}
                  </Chip>
                ))}
              </div>
            )}
            <p className="mt-4 text-sm leading-relaxed text-accent-foreground/85">
              {draft.bio ||
                "Your professional bio will appear here — tell students what you can help with."}
            </p>
            <Button size="sm" className="mt-5 w-full" disabled>
              <CalendarCheck className="size-4" /> Request Session
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            This is how students see your profile
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-xl font-semibold">Incoming session requests</h2>
        {pending.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            No pending requests. Requests made from the Mentorship page appear here instantly —
            manage the full workflow (confirm, propose a new time, or decline) from the{" "}
            <Link to="/mentor-sessions" className="font-medium text-primary underline">
              Sessions
            </Link>{" "}
            page.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-4">
                <Avatar name={s.studentName ?? "Student"} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {s.studentName ?? "Student"} · {s.topic}
                  </p>
                  <p className="text-sm text-muted-foreground">{s.slot}</p>
                </div>
                <Chip tone="warning">{s.status.replace("_", " ")}</Chip>
                <Button size="sm" variant="outline" onClick={() => declineSession(s.id)}>
                  Decline
                </Button>
                <Button size="sm" onClick={() => confirmSession(s.id)}>
                  Confirm
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
