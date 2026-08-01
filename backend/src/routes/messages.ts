import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { connections, mentors, messages, users } from "../db/schema.js";
import { logEvent } from "../logEvent.js";
import { requireAuth } from "../middleware/auth.js";

export const messageRouter = Router();
messageRouter.use(requireAuth);

/** Confirms the current user is either the student or the mentor on this connection. */
async function loadParticipantConnection(userId: string, connectionId: string) {
  const [conn] = await db.select().from(connections).where(eq(connections.id, connectionId)).limit(1);
  if (!conn) return null;
  if (conn.studentId === userId) return conn;
  const [mentor] = await db.select().from(mentors).where(eq(mentors.userId, userId)).limit(1);
  if (mentor && conn.mentorId === mentor.id) return conn;
  return null;
}

/** GET /api/connections/:connectionId/messages — full thread, oldest first. */
messageRouter.get("/:connectionId/messages", async (req, res) => {
  const conn = await loadParticipantConnection(req.user!.id, req.params.connectionId);
  if (!conn) return res.status(404).json({ error: "Connection not found" });

  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      senderName: users.fullName,
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.connectionId, conn.id))
    .orderBy(asc(messages.createdAt));

  res.json({ messages: rows });
});

const sendSchema = z.object({ body: z.string().min(1).max(2000) });

/** POST /api/connections/:connectionId/messages — send a message on this thread. */
messageRouter.post("/:connectionId/messages", async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const conn = await loadParticipantConnection(req.user!.id, req.params.connectionId);
  if (!conn) return res.status(404).json({ error: "Connection not found" });

  const [message] = await db
    .insert(messages)
    .values({ connectionId: conn.id, senderId: req.user!.id, body: parsed.data.body })
    .returning();

  await logEvent(req.user!.id, "message_sent", { connectionId: conn.id });
  res.status(201).json({ message: { ...message, senderName: undefined } });
});
