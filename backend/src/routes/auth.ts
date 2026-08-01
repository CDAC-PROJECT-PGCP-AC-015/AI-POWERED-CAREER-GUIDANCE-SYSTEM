import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client.js";
import { mentors, users } from "../db/schema.js";
import { logEvent } from "../logEvent.js";
import { requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1),
  // Admin accounts are provisioned by the seed script / an existing admin
  // (see routes/admin.ts PATCH /users/:id), never via public self-registration —
  // otherwise anyone could tick "admin" on the sign-up form and get in.
  role: z.enum(["student", "mentor"]).default("student"),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, fullName, role } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(users).values({ email, passwordHash, fullName, role }).returning();

  if (role === "mentor") {
    await db.insert(mentors).values({ userId: user.id });
  }

  await logEvent(user.id, "register", { role });

  const token = signToken({ id: user.id, role: user.role, email: user.email });
  res.status(201).json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid email or password" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await logEvent(user.id, "login_failed", {});
    return res.status(401).json({ error: "Invalid email or password" });
  }

  await logEvent(user.id, "login", {});
  const token = signToken({ id: user.id, role: user.role, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

/** PUT /api/auth/password — works for any signed-in role (student/mentor/admin). */
authRouter.put("/password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  await logEvent(user.id, "password_changed", {});

  res.json({ success: true });
});
