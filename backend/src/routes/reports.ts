import { eq } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/client.js";
import { assessments, careerResults, reports, users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

export const reportRouter = Router();

reportRouter.post("/:resultId", requireAuth, async (req, res) => {
  const [result] = await db
    .select()
    .from(careerResults)
    .where(eq(careerResults.id, req.params.resultId))
    .limit(1);
  if (!result) return res.status(404).json({ error: "Career result not found" });

  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, result.assessmentId)).limit(1);
  if (!assessment || assessment.userId !== req.user!.id) {
    return res.status(404).json({ error: "Career result not found" });
  }

  const [report] = await db.insert(reports).values({ resultId: result.id }).returning();
  res.status(201).json({ report, shareUrl: `/api/reports/shared/${report.shareToken}` });
});

/** Publicly fetchable by share token — no auth required, matches the SDD's "shareable link" feature. */
reportRouter.get("/shared/:token", async (req, res) => {
  const [report] = await db.select().from(reports).where(eq(reports.shareToken, req.params.token)).limit(1);
  if (!report) return res.status(404).json({ error: "Report not found" });

  const [result] = await db.select().from(careerResults).where(eq(careerResults.id, report.resultId)).limit(1);
  const [assessment] = await db.select().from(assessments).where(eq(assessments.id, result.assessmentId)).limit(1);
  const [student] = await db.select().from(users).where(eq(users.id, assessment.userId)).limit(1);

  res.json({
    generatedAt: report.generatedAt,
    student: student?.fullName,
    career: result.predictedCareer,
    fitScore: result.fitScore,
    narrative: result.narrativeReport,
  });
});
