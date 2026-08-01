import { and, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  assessments,
  careerResults,
  connections,
  mentors,
  studentProfiles,
  users,
} from "../db/schema.js";
import { logEvent } from "../logEvent.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const connectionRouter = Router();
connectionRouter.use(requireAuth);

/**
 * "My Students" for a mentor: every distinct student who has requested this
 * mentor (any connection status), but ONLY once that student has actually
 * completed their assessment — a pending request from someone who hasn't
 * finished onboarding isn't a student to coach yet. Includes their top
 * predicted career + roadmap readiness so the mentor has context.
 */
connectionRouter.get("/students", requireRole("mentor"), async (req, res) => {
  const [mentor] = await db.select().from(mentors).where(eq(mentors.userId, req.user!.id)).limit(1);
  if (!mentor) return res.json({ students: [] });

  const myConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.mentorId, mentor.id))
    .orderBy(desc(connections.requestedAt));

  const studentIds = [...new Set(myConnections.map((c) => c.studentId))];
  if (studentIds.length === 0) return res.json({ students: [] });

  const [studentUsers, profiles, studentAssessments] = await Promise.all([
    db.select().from(users).where(inArray(users.id, studentIds)),
    db.select().from(studentProfiles).where(inArray(studentProfiles.userId, studentIds)),
    db.select().from(assessments).where(inArray(assessments.userId, studentIds)),
  ]);

  const completedAssessmentIds = studentAssessments
    .filter((a) => a.status === "completed")
    .map((a) => a.id);
  const results = completedAssessmentIds.length
    ? await db
        .select()
        .from(careerResults)
        .where(inArray(careerResults.assessmentId, completedAssessmentIds))
    : [];

  const rows = studentIds
    .map((studentId) => {
      const user = studentUsers.find((u) => u.id === studentId);
      if (!user) return null;
      const latestCompleted = studentAssessments
        .filter((a) => a.userId === studentId && a.status === "completed")
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
      if (!latestCompleted) return null; // hasn't completed assessment yet — not shown

      const topResult = results
        .filter((r) => r.assessmentId === latestCompleted.id && r.rank === 1)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const profile = profiles.find((p) => p.userId === studentId);
      const roadmap = (profile?.roadmapProgress as Record<string, boolean> | undefined) ?? {};
      const roadmapValues = Object.values(roadmap);
      const readiness = roadmapValues.length
        ? Math.round((roadmapValues.filter(Boolean).length / roadmapValues.length) * 100)
        : 0;

      const relevantConnections = myConnections
        .filter((c) => c.studentId === studentId)
        .sort((a, b) => {
          // Prefer whichever connection is actually "accepted" — that's the
          // one messaging is unlocked for on the student's side — before
          // falling back to most-recently-requested. Guards against any
          // pre-existing duplicate connections for this student+mentor pair.
          if (a.status === "accepted" && b.status !== "accepted") return -1;
          if (b.status === "accepted" && a.status !== "accepted") return 1;
          return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
        });

      return {
        id: user.id,
        name: user.fullName,
        email: user.email,
        topCareer: topResult?.predictedCareer ?? null,
        confidence: topResult ? Math.round(Number(topResult.fitScore)) : null,
        readiness,
        connectionId: relevantConnections[0]?.id ?? null,
        connectionStatus: relevantConnections[0]?.status ?? null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  res.json({ students: rows });
});

/** Sessions relevant to the current user, whichever side they're on — with
 *  both the student's and the mentor's display name attached, since a
 *  mentor's queue needs to show who's requesting, and a student's list
 *  needs to show which mentor they contacted. */
connectionRouter.get("/", async (req, res) => {
  const [mentor] = await db.select().from(mentors).where(eq(mentors.userId, req.user!.id)).limit(1);

  const rows = mentor
    ? await db
        .select({ connection: connections, studentName: users.fullName })
        .from(connections)
        .innerJoin(users, eq(connections.studentId, users.id))
        .where(eq(connections.mentorId, mentor.id))
        .orderBy(desc(connections.requestedAt))
    : await db
        .select({ connection: connections, mentorName: users.fullName })
        .from(connections)
        .innerJoin(mentors, eq(connections.mentorId, mentors.id))
        .innerJoin(users, eq(mentors.userId, users.id))
        .where(eq(connections.studentId, req.user!.id))
        .orderBy(desc(connections.requestedAt));

  const shaped = rows.map((r) => ({
    ...r.connection,
    studentName: "studentName" in r ? r.studentName : undefined,
    mentorName: "mentorName" in r ? r.mentorName : undefined,
  }));
  res.json({ connections: shaped });
});

const requestSchema = z.object({ mentorId: z.string(), topic: z.string(), slot: z.string() });

connectionRouter.post("/", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // If this student already has a live (non-terminal) connection with this
  // mentor, reuse it instead of inserting a second row. Without this, a
  // student clicking "Request session" twice — or re-requesting with a
  // different slot — silently created two connections for the same pair.
  // Each side's UI then independently resolved to a DIFFERENT one of those
  // rows (the student's session list shows every row; the mentor's "My
  // Students" collapses to just the most recent one), so their messages
  // landed on two different threads — looking exactly like a one-way wall.
  const [existing] = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.studentId, req.user!.id),
        eq(connections.mentorId, parsed.data.mentorId),
        inArray(connections.status, ["pending", "accepted", "reschedule_proposed"]),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(connections)
      .set({ topic: parsed.data.topic, slot: parsed.data.slot })
      .where(eq(connections.id, existing.id))
      .returning();
    return res.json({ connection: updated });
  }

  const [connection] = await db
    .insert(connections)
    .values({
      studentId: req.user!.id,
      mentorId: parsed.data.mentorId,
      topic: parsed.data.topic,
      slot: parsed.data.slot,
      status: "pending",
    })
    .returning();
  await logEvent(req.user!.id, "session_requested", { connectionId: connection.id });
  res.status(201).json({ connection });
});

async function loadOwned(userId: string, id: string) {
  const [mentor] = await db.select().from(mentors).where(eq(mentors.userId, userId)).limit(1);
  const [conn] = await db.select().from(connections).where(eq(connections.id, id)).limit(1);
  if (!conn) return null;
  const owns = conn.studentId === userId || (mentor && conn.mentorId === mentor.id);
  return owns ? conn : null;
}

/** Mentor confirms a pending request. */
connectionRouter.post("/:id/confirm", async (req, res) => {
  const conn = await loadOwned(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ error: "Not found" });
  const [updated] = await db
    .update(connections)
    .set({ status: "accepted", slot: conn.proposedSlot ?? conn.slot, proposedSlot: null })
    .where(eq(connections.id, conn.id))
    .returning();
  res.json({ connection: updated });
});

/** Mentor (or student) declines outright. */
connectionRouter.post("/:id/decline", async (req, res) => {
  const conn = await loadOwned(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ error: "Not found" });
  const [updated] = await db
    .update(connections)
    .set({ status: "declined" })
    .where(eq(connections.id, conn.id))
    .returning();
  res.json({ connection: updated });
});

/** Either party cancels an active (pending/accepted) session. */
connectionRouter.post("/:id/cancel", async (req, res) => {
  const conn = await loadOwned(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ error: "Not found" });
  const [updated] = await db
    .update(connections)
    .set({ status: "cancelled" })
    .where(eq(connections.id, conn.id))
    .returning();
  res.json({ connection: updated });
});

const rescheduleSchema = z.object({ proposedSlot: z.string() });

/** Mentor proposes a new time. */
connectionRouter.post("/:id/propose-reschedule", async (req, res) => {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const conn = await loadOwned(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ error: "Not found" });
  const [updated] = await db
    .update(connections)
    .set({ status: "reschedule_proposed", proposedSlot: parsed.data.proposedSlot })
    .where(eq(connections.id, conn.id))
    .returning();
  res.json({ connection: updated });
});

const respondSchema = z.object({ accept: z.boolean() });

/** Student accepts or declines the mentor's proposed new time. */
connectionRouter.post("/:id/respond-reschedule", async (req, res) => {
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const conn = await loadOwned(req.user!.id, req.params.id);
  if (!conn) return res.status(404).json({ error: "Not found" });

  const [updated] = await db
    .update(connections)
    .set(
      parsed.data.accept
        ? { status: "accepted", slot: conn.proposedSlot ?? conn.slot, proposedSlot: null }
        : { status: "cancelled", proposedSlot: null },
    )
    .where(eq(connections.id, conn.id))
    .returning();
  res.json({ connection: updated });
});
