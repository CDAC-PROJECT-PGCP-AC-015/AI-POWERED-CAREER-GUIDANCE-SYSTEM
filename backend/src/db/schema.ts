// AI Powered Career Guidance System — Drizzle schema
// Mirrors SDD §8.1 "Relational Database Schema (PostgreSQL)" table-for-table.
// A few columns are pragmatic extensions beyond the SDD's original set
// (documented inline) to back the mentor-session workflow the frontend uses.

import {
  bigserial,
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["student", "mentor", "admin"]);
export const assessmentStatus = pgEnum("assessment_status", ["in_progress", "completed", "abandoned"]);
export const connectionStatus = pgEnum("connection_status", [
  "pending",
  "accepted",
  "declined",
  "reschedule_proposed",
  "cancelled",
]);

/// Table: m_users
export const users = pgTable("m_users", {
  id: uuid("user_id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: userRole("role").notNull(),
  fullName: varchar("full_name", { length: 150 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

/// Table: student_profiles
export const studentProfiles = pgTable("student_profiles", {
  id: uuid("profile_id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  educationLevel: varchar("education_level", { length: 30 }),
  specialization: varchar("specialization", { length: 100 }),
  marks10thPercent: decimal("marks_10th_percent", { precision: 5, scale: 2 }),
  marks12thPercent: decimal("marks_12th_percent", { precision: 5, scale: 2 }),
  graduationCgpa: decimal("graduation_cgpa", { precision: 4, scale: 2 }),
  postgradCgpa: decimal("postgrad_cgpa", { precision: 4, scale: 2 }),
  skillsTech: jsonb("skills_tech").default([]).notNull(),
  skillsSoft: jsonb("skills_soft").default([]).notNull(),
  interests: jsonb("interests").default([]).notNull(),
  certifications: jsonb("certifications").default([]).notNull(),
  hasInternship: boolean("has_internship").default(false).notNull(),
  internshipDomain: varchar("internship_domain", { length: 100 }),
  internshipDurationMonths: integer("internship_duration_months"),
  personalityType: varchar("personality_type", { length: 50 }),
  /// Extension beyond the SDD's original columns: persists the career-path
  /// checklist so ticked milestones survive logout/login instead of living
  /// only in browser localStorage. Shape: { "<careerId>:<phase>": true }.
  roadmapProgress: jsonb("roadmap_progress").default({}).notNull(),
  /// Extension: Skill Lab "enrolled" course ids, persisted the same way.
  savedCourseIds: jsonb("saved_course_ids").default([]).notNull(),
});

/// Table: assessments
export const assessments = pgTable("assessments", {
  id: uuid("assessment_id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").references(() => studentProfiles.id),
  conversationLog: jsonb("conversation_log").default([]).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  status: assessmentStatus("status").default("in_progress").notNull(),
});

/// Table: career_results
export const careerResults = pgTable("career_results", {
  id: uuid("result_id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  rank: smallint("rank").notNull(),
  predictedCareer: varchar("predicted_career", { length: 100 }).notNull(),
  fitScore: decimal("fit_score", { precision: 5, scale: 2 }).notNull(),
  narrativeReport: text("narrative_report"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/// Table: m_mentors
/// `title`/`company`/`linkedinUrl`/`slots` extend the SDD's original columns
/// to back the Mentor Portal editor + availability picker (see backend/README.md).
export const mentors = pgTable("m_mentors", {
  id: uuid("mentor_id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 150 }),
  company: varchar("company", { length: 150 }),
  expertiseTags: jsonb("expertise_tags").default([]).notNull(),
  bio: text("bio"),
  achievements: text("achievements"),
  linkedinUrl: varchar("linkedin_url", { length: 300 }),
  availability: boolean("availability").default(true).notNull(),
  slots: jsonb("slots").default([]).notNull(),
});

/// Table: m_courses
export const courses = pgTable("m_courses", {
  id: uuid("course_id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  careerTag: varchar("career_tag", { length: 100 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
});

/// Table: connections
/// `topic`/`slot`/`proposedSlot` extend the SDD's original 4 columns to back
/// the confirm/reschedule/cancel session workflow (see backend/README.md).
export const connections = pgTable("connections", {
  id: uuid("connection_id").defaultRandom().primaryKey(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mentorId: uuid("mentor_id")
    .notNull()
    .references(() => mentors.id, { onDelete: "cascade" }),
  status: connectionStatus("status").default("pending").notNull(),
  topic: varchar("topic", { length: 200 }),
  slot: varchar("slot", { length: 100 }),
  proposedSlot: varchar("proposed_slot", { length: 100 }),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
});

/// Table: reports
export const reports = pgTable("reports", {
  id: uuid("report_id").defaultRandom().primaryKey(),
  resultId: uuid("result_id")
    .notNull()
    .references(() => careerResults.id, { onDelete: "cascade" }),
  pdfUrl: varchar("pdf_url", { length: 500 }),
  shareToken: uuid("share_token").defaultRandom().notNull().unique(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

/// Table: messages
/// Extension beyond the SDD's original tables — backs the "Message student"
/// / mentor<->student chat thread attached to a connection (session request).
export const messages = pgTable("messages", {
  id: uuid("message_id").defaultRandom().primaryKey(),
  connectionId: uuid("connection_id")
    .notNull()
    .references(() => connections.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/// Table: l_system_logs
export const systemLogs = pgTable("l_system_logs", {
  id: bigserial("log_id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  details: jsonb("details").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
