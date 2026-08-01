import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Check, MessageCircle, Search, Sparkles, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MessageThread } from "@/components/MessageThread";
import { Avatar, Button, Card, Chip, SectionTitle, inputClass } from "@/components/ui-kit";
import { api } from "@/lib/api-client";
import { useApp, useCareers, type SessionStatus } from "@/lib/app-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mentorship")({
  head: () => ({
    meta: [
      { title: "Mentorship — CareerAI" },
      { name: "description", content: "Browse mentors and request 1:1 guidance sessions." },
      { property: "og:title", content: "Mentorship — CareerAI" },
      { property: "og:description", content: "Talk to people who already walk your target path." },
    ],
  }),
  component: Mentorship,
});

const STATUS_TONE: Record<SessionStatus, "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  accepted: "success",
  reschedule_proposed: "warning",
  declined: "danger",
  cancelled: "neutral",
};

type BackendMentor = {
  id: string;
  title: string | null;
  company: string | null;
  expertiseTags: string[];
  bio: string | null;
  linkedinUrl: string | null;
  slots: string[];
  fullName: string;
};

function Mentorship() {
  const { sessions, requestSession, cancelSession, respondToReschedule, loadSessions, authed } =
    useApp();
  const careers = useCareers();
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<Record<string, string>>({});
  const [allMentors, setAllMentors] = useState<BackendMentor[]>([]);
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"recommended" | "all">("recommended");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);

  // Your top 3 predicted careers, deduped by title.
  const topCareerTitles = useMemo(
    () => [...new Set(careers.slice(0, 3).map((c) => c.title))],
    [careers],
  );

  useEffect(() => {
    if (!authed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.get<{ mentors: BackendMentor[] }>("/mentors"),
      ...topCareerTitles.map((title) =>
        api
          .get<{ mentors: BackendMentor[] }>(`/mentors?career=${encodeURIComponent(title)}`)
          .catch(() => ({ mentors: [] as BackendMentor[] })),
      ),
    ])
      .then(([all, ...recs]) => {
        setAllMentors(all.mentors);
        const ids = new Set(recs.flatMap((r) => r.mentors.map((m) => m.id)));
        setRecommendedIds(ids);
        // If nothing matched (e.g. brand-new careers with no seeded mentors
        // yet), fall back to showing everyone rather than an empty page.
        if (ids.size === 0) setView("all");
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load mentors"))
      .finally(() => setLoading(false));
    loadSessions();
    // topCareerTitles is derived from `careers`, which is stable per session — only re-fetch on auth change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, loadSessions]);

  const baseList = useMemo(
    () => (view === "recommended" ? allMentors.filter((m) => recommendedIds.has(m.id)) : allMentors),
    [allMentors, recommendedIds, view],
  );

  const filtered = useMemo(() => {
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return baseList;
    return baseList.filter((m) => {
      const haystack = `${m.fullName} ${m.company ?? ""} ${m.title ?? ""} ${m.bio ?? ""} ${m.expertiseTags.join(" ")}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [baseList, q]);

  if (!authed) {
    return (
      <AppShell>
        <SectionTitle
          title="Mentorship"
          subtitle="Sign in to browse mentors and request sessions."
        />
        <Card>
          <p className="text-muted-foreground">
            You need to be signed in to see the live mentor directory (it's fetched from the
            backend).
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SectionTitle
        title="Mentorship"
        subtitle="Mentors matched to your top predicted careers. Request a session and track it below."
      />

      <div className="mb-4 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="relative self-start">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(inputClass, "pl-11")}
            placeholder="Search mentors by name, company or skill..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Your requested sessions</p>
          <p className="text-2xl font-bold">{sessions.length}</p>
        </Card>
      </div>

      <div className="mb-6 inline-flex rounded-xl bg-accent p-1">
        <button
          type="button"
          onClick={() => setView("recommended")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            view === "recommended"
              ? "bg-card text-foreground shadow-[var(--shadow-card)]"
              : "text-accent-foreground hover:bg-card/50",
          )}
        >
          <Sparkles className="size-3.5" /> Recommended for you
        </button>
        <button
          type="button"
          onClick={() => setView("all")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            view === "all"
              ? "bg-card text-foreground shadow-[var(--shadow-card)]"
              : "text-accent-foreground hover:bg-card/50",
          )}
        >
          <Users className="size-3.5" /> All mentors ({allMentors.length})
        </button>
      </div>

      {loading && (
        <Card>
          <p className="text-muted-foreground">Loading mentors…</p>
        </Card>
      )}
      {loadError && (
        <Card>
          <p className="text-destructive">{loadError}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check that the backend is running and reachable at the URL in <code>VITE_API_URL</code>.
          </p>
        </Card>
      )}

      {!loading && !loadError && view === "recommended" && (
        <p className="mb-4 text-sm text-muted-foreground">
          Matched to {topCareerTitles.join(", ") || "your predicted careers"}. Not who you're
          looking for? Switch to "All mentors" above.
        </p>
      )}

      {!loading && !loadError && (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((m) => {
            const slots = m.slots.length > 0 ? m.slots : ["Contact to schedule"];
            return (
              <Card key={m.id}>
                <div className="flex items-start gap-4">
                  <Avatar name={m.fullName} className="size-14 text-base" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold">{m.fullName}</p>
                      {recommendedIds.has(m.id) && (
                        <Chip tone="success">
                          <Sparkles className="size-3" /> Recommended
                        </Chip>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {m.title ?? "Mentor"} {m.company ? `· ${m.company}` : ""}
                    </p>
                    {m.bio && (
                      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                        {m.bio}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.expertiseTags.map((e) => (
                        <Chip key={e} tone="neutral">
                          {e}
                        </Chip>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <select
                        className={cn(inputClass, "h-11 w-auto py-0 text-sm")}
                        value={slot[m.id] ?? slots[0]}
                        onChange={(e) => setSlot((s) => ({ ...s, [m.id]: e.target.value }))}
                      >
                        {slots.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() =>
                          requestSession(
                            m.id,
                            m.fullName,
                            "Career guidance",
                            slot[m.id] ?? slots[0],
                          )
                        }
                      >
                        <CalendarPlus className="size-4" /> Request session
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card>
              <p className="text-muted-foreground">
                {allMentors.length === 0
                  ? "No mentors have registered yet."
                  : q
                    ? `No mentors match "${q}".`
                    : "No mentors matched your predicted careers yet — try “All mentors” above."}
              </p>
            </Card>
          )}
        </div>
      )}

      {sessions.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-xl font-semibold">Your sessions</h2>
          <ul className="mt-4 divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{s.mentorName}</span>
                  <span className="text-sm text-muted-foreground">{s.topic}</span>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {s.status === "reschedule_proposed" ? (
                      <>
                        <s className="opacity-60">{s.slot}</s> →{" "}
                        <span className="font-medium text-foreground">{s.proposedSlot}</span>
                      </>
                    ) : (
                      s.slot
                    )}
                  </span>
                  <Chip tone={STATUS_TONE[s.status]}>{s.status.replace("_", " ")}</Chip>

                  {s.status === "reschedule_proposed" && (
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respondToReschedule(s.id, false)}
                      >
                        <X className="size-4" /> Decline
                      </Button>
                      <Button size="sm" onClick={() => respondToReschedule(s.id, true)}>
                        <Check className="size-4" /> Accept
                      </Button>
                    </div>
                  )}
                  {(s.status === "pending" || s.status === "accepted") && (
                    <Button size="sm" variant="ghost" onClick={() => cancelSession(s.id)}>
                      Cancel
                    </Button>
                  )}
                </div>

                {/* Messaging only opens up once the mentor has approved the
                    request — there's nothing to coordinate about before that. */}
                {s.status === "accepted" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setOpenThread(openThread === s.id ? null : s.id)}
                    >
                      <MessageCircle className="size-4" />
                      {openThread === s.id ? "Hide conversation" : "Message mentor"}
                    </Button>
                    {openThread === s.id && (
                      <MessageThread connectionId={s.id} otherPartyName={s.mentorName} />
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
