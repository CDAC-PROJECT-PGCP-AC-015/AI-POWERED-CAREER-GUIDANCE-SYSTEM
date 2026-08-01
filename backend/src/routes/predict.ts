import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/client.js";
import { assessments, careerResults, studentProfiles } from "../db/schema.js";
import { logEvent } from "../logEvent.js";
import { requireAuth } from "../middleware/auth.js";

export const predictRouter = Router();
predictRouter.use(requireAuth);

const MODEL_URL = process.env.CAREER_MODEL_URL ?? "http://localhost:8000/predict";
const MODEL_KEY = process.env.CAREER_MODEL_KEY;

type RawPrediction = { career_id: string; title: string; confidence: number };

/**
 * POST /api/predict/:assessmentId
 * Calls the FastAPI ML microservice (see /ml-service) with this student's
 * profile + conversation transcript, then persists the top-3 results into
 * career_results (SDD §8.1 "Table: career_results").
 */
predictRouter.post("/:assessmentId", async (req, res) => {
  const [assessment] = await db
    .select()
    .from(assessments)
    .where(and(eq(assessments.id, req.params.assessmentId), eq(assessments.userId, req.user!.id)))
    .limit(1);
  if (!assessment) return res.status(404).json({ error: "Assessment not found" });

  const profile = assessment.profileId
    ? (await db.select().from(studentProfiles).where(eq(studentProfiles.id, assessment.profileId)).limit(1))[0]
    : undefined;

  const conversation = Array.isArray(assessment.conversationLog) ? (assessment.conversationLog as any[]) : [];
  const answers = conversation
    .filter((m: any) => m.role === "user")
    .map((m: any, i: number) => ({ question: `Q${i + 1}`, answer: m.content }));

  const payload = {
    profile: profile
      ? {
          education_level: profile.educationLevel,
          specialization: profile.specialization,
          marks_10th_percent: profile.marks10thPercent ? Number(profile.marks10thPercent) : undefined,
          marks_12th_percent: profile.marks12thPercent ? Number(profile.marks12thPercent) : undefined,
          graduation_cgpa: profile.graduationCgpa ? Number(profile.graduationCgpa) : undefined,
          postgrad_cgpa: profile.postgradCgpa ? Number(profile.postgradCgpa) : undefined,
          skills_tech: profile.skillsTech,
          skills_soft: profile.skillsSoft,
          interests: profile.interests,
          certifications: profile.certifications,
          has_internship: profile.hasInternship,
          internship_domain: profile.internshipDomain,
          internship_duration_months: profile.internshipDurationMonths,
        }
      : {},
    answers,
  };

  let predictions: RawPrediction[];
  try {
    const resp = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(MODEL_KEY ? { "x-api-key": MODEL_KEY } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`ML service responded ${resp.status}`);
    const data = (await resp.json()) as { predictions: RawPrediction[] };
    predictions = data.predictions.slice(0, 3);
  } catch (err) {
    await logEvent(req.user!.id, "prediction_failed", { error: String(err) });
    return res.status(502).json({
      error: "ML service unavailable. Is ml-service running and CAREER_MODEL_URL set correctly?",
      detail: String(err),
    });
  }

  const results = await Promise.all(
    predictions.map((p, i) =>
      db
        .insert(careerResults)
        .values({
          assessmentId: assessment.id,
          rank: i + 1,
          predictedCareer: p.title,
          fitScore: String(Math.round(p.confidence <= 1 ? p.confidence * 100 : p.confidence)),
        })
        .returning()
        .then((rows) => rows[0]),
    ),
  );

  await logEvent(req.user!.id, "prediction", { assessmentId: assessment.id, top: predictions[0]?.title });
  res.json({ results });
});
