import { asc, ilike } from "drizzle-orm";
import { Router } from "express";
import { db } from "../db/client.js";
import { courses } from "../db/schema.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const courseRouter = Router();

courseRouter.get("/", requireAuth, async (req, res) => {
  const careerTag = typeof req.query.career === "string" ? req.query.career : undefined;
  const rows = careerTag
    ? await db.select().from(courses).where(ilike(courses.careerTag, careerTag)).orderBy(asc(courses.title))
    : await db.select().from(courses).orderBy(asc(courses.title));
  res.json({ courses: rows });
});

courseRouter.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const { title, platform, careerTag, url } = req.body ?? {};
  if (!title || !platform || !careerTag || !url) {
    return res.status(400).json({ error: "title, platform, careerTag and url are required" });
  }
  const [course] = await db.insert(courses).values({ title, platform, careerTag, url }).returning();
  res.status(201).json({ course });
});
