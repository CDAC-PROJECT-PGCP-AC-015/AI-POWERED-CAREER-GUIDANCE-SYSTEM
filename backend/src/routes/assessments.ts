import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { assessments, careerResults, studentProfiles } from "../db/schema.js";
import { logEvent } from "../logEvent.js";
import { requireAuth } from "../middleware/auth.js";

export const assessmentRouter = Router();
assessmentRouter.use(requireAuth);

assessmentRouter.post("/start", async (req, res) => {
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, req.user!.id))
    .limit(1);

  const [assessment] = await db
    .insert(assessments)
    .values({ userId: req.user!.id, profileId: profile?.id, status: "in_progress", conversationLog: [] })
    .returning();

  await logEvent(req.user!.id, "assessment_started", { assessmentId: assessment.id });
  res.status(201).json({ assessment });
});

const messageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string() });

assessmentRouter.post("/:id/message", async (req, res) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.id, req.params.id), eq(assessments.userId, req.user!.id)))
    .limit(1);
  if (!assessment) return res.status(404).json({ error: "Assessment not found" });

  const log = Array.isArray(assessment.conversationLog) ? (assessment.conversationLog as any[]) : [];
  const [updated] = await db
    .update(assessments)
    .set({ conversationLog: [...log, { ...parsed.data, at: new Date().toISOString() }] })
    .where(eq(assessments.id, assessment.id))
    .returning();

  res.json({ assessment: updated });
});

assessmentRouter.post("/:id/complete", async (req, res) => {
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.id, req.params.id), eq(assessments.userId, req.user!.id)))
    .limit(1);
  if (!assessment) return res.status(404).json({ error: "Assessment not found" });

  const [updated] = await db
    .update(assessments)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(assessments.id, assessment.id))
    .returning();

  await logEvent(req.user!.id, "assessment_completed", { assessmentId: assessment.id });
  res.json({ assessment: updated });
});

assessmentRouter.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(assessments)
    .where(eq(assessments.userId, req.user!.id))
    .orderBy(desc(assessments.startedAt));

  const withResults = await Promise.all(
    rows.map(async (a) => ({
      ...a,
      results: await db.select().from(careerResults).where(eq(careerResults.assessmentId, a.id)),
    })),
  );
  res.json({ assessments: withResults });
});

const resultsSchema = z.object({
  results: z.array(
    z.object({ title: z.string(), confidence: z.number(), narrative: z.string().optional() }),
  ),
});

/**
 * POST /api/assessments/:id/results
 * For when predictions were already computed elsewhere (e.g. the frontend's
 * existing LLM-enrichment flow, which already calls the ML service itself)
 * and just need to be persisted for history/admin visibility — as opposed
 * to POST /api/predict/:id, which calls the ML service itself.
 */
assessmentRouter.post("/:id/results", async (req, res) => {
  const parsed = resultsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [assessment] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.id, req.params.id), eq(assessments.userId, req.user!.id)))
    .limit(1);
  if (!assessment) return res.status(404).json({ error: "Assessment not found" });

  const rows = await Promise.all(
    parsed.data.results.slice(0, 3).map((r, i) =>
      db
        .insert(careerResults)
        .values({
          assessmentId: assessment.id,
          rank: i + 1,
          predictedCareer: r.title,
          fitScore: String(Math.round(r.confidence)),
          narrativeReport: r.narrative,
        })
        .returning()
        .then((rows) => rows[0]),
    ),
  );

  await logEvent(req.user!.id, "prediction_saved", { assessmentId: assessment.id, top: parsed.data.results[0]?.title });
  res.status(201).json({ results: rows });
});
