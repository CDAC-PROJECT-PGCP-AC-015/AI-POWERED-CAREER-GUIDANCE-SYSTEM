import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock, Plus, RotateCcw, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Button, Card, Chip, SectionTitle, inputClass } from "@/components/ui-kit";
import { useApp, type SessionRequest, type SessionStatus } from "@/lib/app-store";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// Selectable (not free-typed) 45-minute slots between 6 PM and 10 PM, the
// window most mentors are actually available after their day job.
const TIME_SLOTS = [
  "6:00 PM – 6:45 PM",
  "7:00 PM – 7:45 PM",
  "8:00 PM – 8:45 PM",
  "9:00 PM – 9:45 PM",
  "9:15 PM – 10:00 PM",
];

export const Route = createFileRoute("/mentor-sessions")({
  head: () => ({
    meta: [
      { title: "Sessions — CareerAI Mentor" },
      {
        name: "description",
        content: "Confirm session requests and manage your weekly mentoring availability.",
      },
      { property: "og:title", content: "Sessions — CareerAI Mentor" },
      { property: "og:description", content: "Manage mentoring sessions and availability." },
    ],
  }),
  component: MentorSessions,
});

const STATUS_TONE: Record<SessionStatus, "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  accepted: "success",
  reschedule_proposed: "warning",
  declined: "danger",
  cancelled: "neutral",
};

function SessionRow({ s }: { s: SessionRequest }) {
  const { confirmSession, declineSession, cancelSession, proposeReschedule } = useApp();
  const [reschedOpen, setReschedOpen] = useState(false);
  const [newSlot, setNewSlot] = useState("");

  const isOpen = s.status === "pending";
  const isAccepted = s.status === "accepted";
  const isProposed = s.status === "reschedule_proposed";

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={s.studentName ?? "Student"} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {s.studentName ?? "Student"} · {s.topic}
          </p>
          <p className="text-sm text-muted-foreground">
            {isProposed ? <s className="opacity-60">{s.slot}</s> : s.slot}
            {isProposed && s.proposedSlot && (
              <span className="ml-1 font-medium text-foreground"> → {s.proposedSlot}</span>
            )}
          </p>
        </div>
        <Chip tone={STATUS_TONE[s.status]}>{s.status.replace("_", " ")}</Chip>

        {isOpen && (
          <>
            <Button size="sm" variant="outline" onClick={() => setReschedOpen((v) => !v)}>
              <RotateCcw className="size-4" /> Propose new time
            </Button>
            <Button size="sm" variant="outline" onClick={() => declineSession(s.id)}>
              <XCircle className="size-4" /> Decline
            </Button>
            <Button size="sm" onClick={() => confirmSession(s.id)}>
              <CheckCircle2 className="size-4" /> Confirm
            </Button>
          </>
        )}
        {isProposed && <Chip tone="neutral">Waiting on student</Chip>}
        {isAccepted && (
          <Button size="sm" variant="danger" onClick={() => cancelSession(s.id)}>
            <X className="size-4" /> Cancel
          </Button>
        )}
      </div>

      {reschedOpen && isOpen && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3">
          <select
            className={`${inputClass} h-10 w-auto`}
            value={newSlot}
            onChange={(e) => setNewSlot(e.target.value)}
          >
            <option value="">Select a new time…</option>
            {DAYS.flatMap((d) => TIME_SLOTS.map((t) => `${d} ${t}`)).map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!newSlot.trim()}
            onClick={() => {
              proposeReschedule(s.id, newSlot.trim());
              setReschedOpen(false);
              setNewSlot("");
            }}
          >
            Send proposal
          </Button>
        </div>
      )}
    </li>
  );
}

function MentorSessions() {
  const {
    sessions,
    mentorProfile,
    addAvailabilitySlot,
    removeAvailabilitySlot,
    loadSessions,
    loadMentorProfile,
    updateMentorProfile,
    logActivity,
  } = useApp();
  const [day, setDay] = useState("Mon");
  const [time, setTime] = useState(TIME_SLOTS[0]);
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);

  useEffect(() => {
    loadSessions();
    loadMentorProfile();
  }, [loadSessions, loadMentorProfile]);

  const activeSessions = sessions.filter(
    (s) => s.status !== "cancelled" && s.status !== "declined",
  );
  const pastSessions = sessions.filter((s) => s.status === "cancelled" || s.status === "declined");

  async function publish() {
    if (mentorProfile.slots.length === 0) return;
    setPublishing(true);
    try {
      // Slots are already saved as each one is added, but "Publish" is where
      // we actually flip availability=true on the backend so students see
      // this mentor (and these slots) in the directory — it wasn't wired to
      // any real call before.
      await updateMentorProfile({ availability: true });
      logActivity({
        kind: "system",
        title: "Availability published",
        detail: `${mentorProfile.slots.length} weekly slot(s) are now visible to students.`,
      });
      setJustPublished(true);
      setTimeout(() => setJustPublished(false), 3000);
    } finally {
      setPublishing(false);
    }
  }

  function addSlot() {
    addAvailabilitySlot(`${day} ${time}`);
  }

  return (
    <AppShell>
      <SectionTitle
        title="Sessions"
        subtitle="Requests from students and your weekly availability."
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="text-xl font-semibold">Session requests</h2>
          {activeSessions.length === 0 ? (
            <p className="mt-4 text-muted-foreground">
              No requests yet. Anything a student books from the Mentorship page lands here.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {activeSessions.map((s) => (
                <SessionRow key={s.id} s={s} />
              ))}
            </ul>
          )}

          {pastSessions.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                {pastSessions.length} declined/cancelled
              </summary>
              <ul className="mt-2 divide-y divide-border opacity-70">
                {pastSessions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar name={s.studentName ?? "Student"} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {s.studentName ?? "Student"} · {s.topic}
                      </p>
                      <p className="text-sm text-muted-foreground">{s.slot}</p>
                    </div>
                    <Chip tone={STATUS_TONE[s.status]}>{s.status}</Chip>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-semibold">Weekly availability</h2>
          <p className="mt-1 text-sm text-muted-foreground">Slots students can book against.</p>
          <ul className="mt-5 space-y-3">
            {mentorProfile.slots.map((slot) => (
              <li
                key={slot}
                className="flex items-center gap-3 rounded-xl border border-border p-4"
              >
                <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground">
                  <CalendarDays className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    <Clock className="mr-1 inline size-3" />
                    {slot}
                  </p>
                </div>
                <button
                  onClick={() => removeAvailabilitySlot(slot)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label={`Remove ${slot}`}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
            {mentorProfile.slots.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No slots published yet — add one below.
              </p>
            )}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2">
            <select
              className={`${inputClass} h-11 w-auto py-0`}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            >
              {DAYS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              className={`${inputClass} h-11 min-w-[200px] flex-1 py-0`}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={addSlot}>
              <Plus className="size-4" /> Add
            </Button>
          </div>

          <Button
            variant="soft"
            className="mt-4 w-full"
            onClick={publish}
            disabled={publishing || mentorProfile.slots.length === 0}
          >
            {justPublished ? (
              <>
                <CheckCircle2 className="size-4" /> Published
              </>
            ) : publishing ? (
              "Publishing…"
            ) : (
              "Publish availability"
            )}
          </Button>
          {mentorProfile.slots.length === 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Add at least one slot above before publishing.
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
