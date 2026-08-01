import { Loader2, MessageCircle, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";
import { Avatar, inputClass } from "./ui-kit";

type ThreadMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
};

// Light polling instead of a websocket — there's no realtime infra in this
// project, but a 4s poll while a thread is open is enough to make a
// conversation feel two-way without either side needing to manually refresh.
const POLL_MS = 4000;

function formatTime(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" }) +
        " · " +
        d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * A message thread for one connection (session request). Used on both the
 * mentor's "My Students" page and the student's "Mentorship" page — same
 * component, same conversation, just viewed from either side.
 */
export function MessageThread({
  connectionId,
  otherPartyName,
}: {
  connectionId: string;
  otherPartyName: string;
}) {
  const { authUser } = useApp();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    () =>
      api
        .get<{ messages: ThreadMessage[] }>(`/connections/${connectionId}/messages`)
        .then((res) => setMessages(res.messages)),
    [connectionId],
  );

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));

    const id = setInterval(() => load().catch(() => {}), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft("");
    setSending(true);
    try {
      await api.post(`/connections/${connectionId}/messages`, { body });
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-accent/60 px-4 py-2.5">
        <MessageCircle className="size-4 text-primary" />
        <p className="text-sm font-semibold">Conversation with {otherPartyName}</p>
      </div>

      <div ref={listRef} className="max-h-72 min-h-[7rem] space-y-3 overflow-y-auto bg-card/40 px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No messages yet — say hello to {otherPartyName}.
          </p>
        )}
        {!loading &&
          messages.map((m, i) => {
            const mine = m.senderId === authUser?.id;
            const prev = messages[i - 1];
            // Group consecutive messages from the same sender — only show
            // the avatar/name once per cluster instead of on every bubble.
            const isNewCluster = !prev || prev.senderId !== m.senderId;
            return (
              <div
                key={m.id}
                className={cn("flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row")}
              >
                {!mine && (
                  <div className="w-7 shrink-0">
                    {isNewCluster && <Avatar name={m.senderName} className="size-7 text-[10px]" />}
                  </div>
                )}
                <div className={cn("flex max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      mine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-accent text-accent-foreground",
                    )}
                  >
                    {m.body}
                  </div>
                  <span className="mt-1 px-1 text-[10px] text-muted-foreground">
                    {formatTime(m.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-card p-2.5">
        <input
          className={cn(inputClass, "h-10 py-0 text-sm")}
          placeholder={`Message ${otherPartyName}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !draft.trim()}
          aria-label="Send message"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </div>
  );
}
