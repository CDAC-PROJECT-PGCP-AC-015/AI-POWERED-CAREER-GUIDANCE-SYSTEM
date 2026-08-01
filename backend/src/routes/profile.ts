import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { studentProfiles } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const profileSchema = z.object({
  educationLevel: z.string().optional(),
  specialization: z.string().optional(),
  marks10thPercent: z.number().optional(),
  marks12thPercent: z.number().optional(),
  graduationCgpa: z.number().optional(),
  postgradCgpa: z.number().optional(),
  skillsTech: z.array(z.string()).optional(),
  skillsSoft: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  hasInternship: z.boolean().optional(),
  internshipDomain: z.string().optional(),
  internshipDurationMonths: z.number().optional(),
  personalityType: z.string().optional(),
  // Extensions: see db/schema.ts studentProfiles comments.
  roadmapProgress: z.record(z.boolean()).optional(),
  savedCourseIds: z.array(z.string()).optional(),
});

function toDbValues(p: z.infer<typeof profileSchema>) {
  return {
    ...p,
    marks10thPercent: p.marks10thPercent?.toString(),
    marks12thPercent: p.marks12thPercent?.toString(),
    graduationCgpa: p.graduationCgpa?.toString(),
    postgradCgpa: p.postgradCgpa?.toString(),
  };
}

profileRouter.get("/me", async (req, res) => {
  const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, req.user!.id)).limit(1);
  res.json({ profile: profile ?? null });
});

profileRouter.put("/me", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const values: Record<string, unknown> = toDbValues(parsed.data);

  const [existing] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, req.user!.id))
    .limit(1);

  if (values.roadmapProgress && existing?.roadmapProgress) {
    values.roadmapProgress = {
      ...(existing.roadmapProgress as Record<string, boolean>),
      ...(values.roadmapProgress as Record<string, boolean>),
    };
  }

  const [profile] = existing
    ? await db
        .update(studentProfiles)
        .set(values)
        .where(eq(studentProfiles.userId, req.user!.id))
        .returning()
    : await db
        .insert(studentProfiles)
        .values({ userId: req.user!.id, ...values })
        .returning();

  res.json({ profile });
});
