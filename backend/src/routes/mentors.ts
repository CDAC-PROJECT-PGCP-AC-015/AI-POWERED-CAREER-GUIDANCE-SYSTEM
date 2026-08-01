import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { mentors, users } from "../db/schema.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const mentorRouter = Router();

/** Directory of available mentors — any authenticated user can browse. */
mentorRouter.get("/", requireAuth, async (req, res) => {
  const careerTag = typeof req.query.career === "string" ? req.query.career.toLowerCase() : undefined;
  const rows = await db
    .select({
      id: mentors.id,
      title: mentors.title,
      company: mentors.company,
      expertiseTags: mentors.expertiseTags,
      bio: mentors.bio,
      achievements: mentors.achievements,
      linkedinUrl: mentors.linkedinUrl,
      availability: mentors.availability,
      slots: mentors.slots,
      fullName: users.fullName,
      email: users.email,
    })
    .from(mentors)
    .innerJoin(users, eq(mentors.userId, users.id))
    .where(eq(mentors.availability, true));

  const filtered = careerTag
    ? rows.filter((m) => JSON.stringify(m.expertiseTags).toLowerCase().includes(careerTag))
    : rows;
  res.json({ mentors: filtered });
});

mentorRouter.get("/me", requireAuth, requireRole("mentor"), async (req, res) => {
  const [mentor] = await db.select().from(mentors).where(eq(mentors.userId, req.user!.id)).limit(1);
  res.json({ mentor: mentor ?? null });
});

const mentorProfileSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  expertiseTags: z.array(z.string()).optional(),
  bio: z.string().optional(),
  achievements: z.string().optional(),
  linkedinUrl: z.string().optional(),
  availability: z.boolean().optional(),
});

async function upsertMentor(userId: string, values: Record<string, unknown>) {
  const [existing] = await db.select().from(mentors).where(eq(mentors.userId, userId)).limit(1);
  if (existing) {
    const [updated] = await db.update(mentors).set(values).where(eq(mentors.userId, userId)).returning();
    return updated;
  }
  const [created] = await db.insert(mentors).values({ userId, ...values }).returning();
  return created;
}

mentorRouter.put("/me", requireAuth, requireRole("mentor"), async (req, res) => {
  const parsed = mentorProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const mentor = await upsertMentor(req.user!.id, parsed.data);
  res.json({ mentor });
});

const slotsSchema = z.object({ slots: z.array(z.string()) });

mentorRouter.put("/me/slots", requireAuth, requireRole("mentor"), async (req, res) => {
  const parsed = slotsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const mentor = await upsertMentor(req.user!.id, { slots: parsed.data.slots });
  res.json({ mentor });
});
