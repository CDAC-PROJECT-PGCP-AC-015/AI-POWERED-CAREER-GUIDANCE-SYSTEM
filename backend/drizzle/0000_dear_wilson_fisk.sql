CREATE TYPE "public"."assessment_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('pending', 'accepted', 'declined', 'reschedule_proposed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'mentor', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessments" (
	"assessment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile_id" uuid,
	"conversation_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" "assessment_status" DEFAULT 'in_progress' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "career_results" (
	"result_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"predicted_career" varchar(100) NOT NULL,
	"fit_score" numeric(5, 2) NOT NULL,
	"narrative_report" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connections" (
	"connection_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"status" "connection_status" DEFAULT 'pending' NOT NULL,
	"topic" varchar(200),
	"slot" varchar(100),
	"proposed_slot" varchar(100),
	"requested_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "m_courses" (
	"course_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"career_tag" varchar(100) NOT NULL,
	"url" varchar(500) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "m_mentors" (
	"mentor_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(150),
	"company" varchar(150),
	"expertise_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bio" text,
	"achievements" text,
	"linkedin_url" varchar(300),
	"availability" boolean DEFAULT true NOT NULL,
	"slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "m_mentors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"report_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"pdf_url" varchar(500),
	"share_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reports_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_profiles" (
	"profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"education_level" varchar(30),
	"specialization" varchar(100),
	"marks_10th_percent" numeric(5, 2),
	"marks_12th_percent" numeric(5, 2),
	"graduation_cgpa" numeric(4, 2),
	"postgrad_cgpa" numeric(4, 2),
	"skills_tech" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills_soft" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"has_internship" boolean DEFAULT false NOT NULL,
	"internship_domain" varchar(100),
	"internship_duration_months" integer,
	"personality_type" varchar(50),
	CONSTRAINT "student_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "l_system_logs" (
	"log_id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"event_type" varchar(50) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "m_users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"full_name" varchar(150) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "m_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_m_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."m_users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assessments" ADD CONSTRAINT "assessments_profile_id_student_profiles_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."student_profiles"("profile_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "career_results" ADD CONSTRAINT "career_results_assessment_id_assessments_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("assessment_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connections" ADD CONSTRAINT "connections_student_id_m_users_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."m_users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connections" ADD CONSTRAINT "connections_mentor_id_m_mentors_mentor_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."m_mentors"("mentor_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "m_mentors" ADD CONSTRAINT "m_mentors_user_id_m_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."m_users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_result_id_career_results_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."career_results"("result_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_m_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."m_users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "l_system_logs" ADD CONSTRAINT "l_system_logs_user_id_m_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."m_users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
