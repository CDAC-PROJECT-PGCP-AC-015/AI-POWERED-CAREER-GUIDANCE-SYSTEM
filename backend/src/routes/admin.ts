import bcrypt from "bcryptjs";
import { desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  assessments,
  careerResults,
  connections,
  mentors,
  studentProfiles,
  systemLogs,
  users,
} from "../db/schema.js";
import { logEvent } from "../logEvent.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("admin"));

const createUserSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["student", "mentor", "admin"]),
});

/**
 * Admin-only account creation — this is the ONLY way to create an admin
 * account (public /auth/register deliberately only allows student/mentor,
 * see routes/auth.ts). Also usable to create mentor/student accounts
 * directly without going through self-registration.
 */
adminRouter.post("/users", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { fullName, email, password, role } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(users).values({ email, passwordHash, fullName, role }).returning();
  if (role === "mentor") {
    await db.insert(mentors).values({ userId: user.id });
  }

  await logEvent(req.user!.id, "admin_created_user", { createdUserId: user.id, role });
  res.status(201).json({
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isActive: user.isActive },
  });
});

adminRouter.get("/users", async (_req, res) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(50);
  res.json({ users: rows });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const { isActive, role } = req.body ?? {};
  const [user] = await db
    .update(users)
    .set({
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(role ? { role } : {}),
    })
    .where(eq(users.id, req.params.id))
    .returning();
  res.json({ user });
});

adminRouter.get("/stats", async (_req, res) => {
  const allUsers = await db.select().from(users);
  const allMentors = await db.select().from(mentors);
  const allAssessments = await db.select().from(assessments);
  const topResults = await db.select().from(careerResults).where(eq(careerResults.rank, 1));

  const avgTopMatch =
    topResults.length > 0
      ? Math.round(
          topResults.reduce((sum, r) => sum + Number(r.fitScore), 0) / topResults.length,
        )
      : 0;

  res.json({
    totalStudents: allUsers.filter((u) => u.role === "student").length,
    totalMentors: allUsers.filter((u) => u.role === "mentor").length,
    assessmentsCompleted: allAssessments.filter((a) => a.status === "completed").length,
    activeMentors: allMentors.filter((m) => m.availability).length,
    avgTopMatch,
  });
});

/**
 * Real (not hand-authored) distribution of each student's #1 predicted
 * career, computed from career_results — powers the admin dashboard's
 * "Predicted career distribution" panel with actual data instead of the
 * fixed 46/33/21 demo split.
 */
adminRouter.get("/career-distribution", async (_req, res) => {
  const topResults = await db.select().from(careerResults).where(eq(careerResults.rank, 1));
  const total = topResults.length;
  const counts = new Map<string, number>();
  for (const r of topResults) {
    counts.set(r.predictedCareer, (counts.get(r.predictedCareer) ?? 0) + 1);
  }
  const distribution = [...counts.entries()]
    .map(([career, count]) => ({
      career,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  res.json({ distribution, total });
});

/**
 * Every enrolled student with their latest assessment status, top predicted
 * career, roadmap readiness and assigned mentor — replaces the frontend's
 * previously hardcoded STUDENTS/COHORTS fixtures (src/lib/org-data.ts) with
 * live data. No institution/cohort concept exists in the schema, so this
 * intentionally has no cohort/batch grouping.
 */
adminRouter.get("/students", async (_req, res) => {
  const students = await db.select().from(users).where(eq(users.role, "student"));
  if (students.length === 0) return res.json({ students: [] });
  const studentIds = students.map((s) => s.id);

  const [profiles, allAssessments, allConnections, allMentors, mentorUsers] = await Promise.all([
    db.select().from(studentProfiles).where(inArray(studentProfiles.userId, studentIds)),
    db.select().from(assessments).where(inArray(assessments.userId, studentIds)),
    db.select().from(connections).where(inArray(connections.studentId, studentIds)),
    db.select().from(mentors),
    db.select().from(users).where(eq(users.role, "mentor")),
  ]);

  const assessmentIds = allAssessments.map((a) => a.id);
  const allResults = assessmentIds.length
    ? await db.select().from(careerResults).where(inArray(careerResults.assessmentId, assessmentIds))
    : [];

  const mentorNameById = new Map(
    allMentors.map((m) => [
      m.id,
      mentorUsers.find((u) => u.id === m.userId)?.fullName ?? "Mentor",
    ]),
  );

  const rows = students.map((s) => {
    const profile = profiles.find((p) => p.userId === s.id);
    const studentAssessments = allAssessments
      .filter((a) => a.userId === s.id)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const latest = studentAssessments[0];
    const assessmentStatus = !latest
      ? "not-started"
      : latest.status === "completed"
        ? "completed"
        : "in-progress";
    const topResult = latest
      ? allResults
          .filter((r) => r.assessmentId === latest.id && r.rank === 1)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : undefined;

    const roadmap = (profile?.roadmapProgress as Record<string, boolean> | undefined) ?? {};
    const roadmapValues = Object.values(roadmap);
    const readiness = roadmapValues.length
      ? Math.round((roadmapValues.filter(Boolean).length / roadmapValues.length) * 100)
      : 0;

    const activeConnection = allConnections
      .filter((c) => c.studentId === s.id && c.status === "accepted")
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];

    return {
      id: s.id,
      name: s.fullName,
      email: s.email,
      isActive: s.isActive,
      assessment: assessmentStatus as "completed" | "in-progress" | "not-started",
      topCareer: topResult?.predictedCareer ?? null,
      confidence: topResult ? Math.round(Number(topResult.fitScore)) : null,
      readiness,
      mentor: activeConnection ? (mentorNameById.get(activeConnection.mentorId) ?? null) : null,
    };
  });

  res.json({ students: rows });
});

/**
 * Every mentor with their profile + how many session requests they've
 * received — replaces org-data.ts's hardcoded mentor fixtures. (Previously
 * the admin UI only listed mentors via /admin/users, which works but gives
 * no mentorship-specific detail like expertise or request volume.)
 */
adminRouter.get("/mentors", async (_req, res) => {
  const allMentors = await db
    .select({
      id: mentors.id,
      userId: mentors.userId,
      title: mentors.title,
      company: mentors.company,
      expertiseTags: mentors.expertiseTags,
      availability: mentors.availability,
      fullName: users.fullName,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(mentors)
    .innerJoin(users, eq(mentors.userId, users.id))
    .orderBy(desc(users.createdAt));

  const mentorIds = allMentors.map((m) => m.id);
  const allConnections = mentorIds.length
    ? await db.select().from(connections).where(inArray(connections.mentorId, mentorIds))
    : [];

  const rows = allMentors.map((m) => ({
    ...m,
    totalRequests: allConnections.filter((c) => c.mentorId === m.id).length,
    pendingRequests: allConnections.filter((c) => c.mentorId === m.id && c.status === "pending")
      .length,
  }));

  res.json({ mentors: rows });
});

adminRouter.get("/logs", async (req, res) => {
  const take = Math.min(Number(req.query.take) || 100, 500);
  const rows = await db.select().from(systemLogs).orderBy(desc(systemLogs.createdAt)).limit(take);
  res.json({ logs: rows });
});
