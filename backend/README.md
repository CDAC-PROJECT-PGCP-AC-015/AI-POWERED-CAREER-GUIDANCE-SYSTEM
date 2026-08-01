# AI Career Guidance — Backend (Express + PostgreSQL)

Implements the SDD's 3-tier architecture: this is the **Node.js/Express main
server** (§7.1) sitting between the React frontend, the `ml-service/`
FastAPI microservice, and a real PostgreSQL database (§8.1). Every route
below was actually run against a live Postgres instance while building this
— not just written and assumed correct.

## Schema

`src/db/schema.ts` mirrors the SDD's 9 tables **name-for-name and
column-for-column**, with a handful of deliberate, documented extensions
needed to make the frontend's mentor-session workflow actually work:

| Table | Extension | Why |
|---|---|---|
| `m_mentors` | `title`, `company`, `linkedin_url`, `slots` | Backs the Mentor Portal profile editor + availability picker |
| `connections` | `topic`, `slot`, `proposed_slot`, plus `reschedule_proposed`/`cancelled` on the status enum | Backs the confirm/reschedule/cancel workflow (originally just pending/accepted/declined) |

Nothing else was changed — table names (`m_users`, `student_profiles`,
`assessments`, `career_results`, `m_mentors`, `m_courses`, `connections`,
`reports`, `l_system_logs`), the master/everyday/log naming convention, and
every other column match the SDD exactly.

**Note on ORM choice:** this uses **Drizzle**, not the Sequelize mentioned
in the SDD. Functionally equivalent (typed queries, migrations, no raw SQL
injection risk) — swapped in because it doesn't require downloading a
native binary at install/migrate time, which made it possible to fully
test this in a network-sandboxed environment. If you'd rather have
Sequelize or Prisma specifically to match your SDD exactly, say so and I'll
swap the data layer — the route logic won't need to change.

## Running it

### Option A — Docker (recommended, matches SDD's 3-tier picture exactly)

```bash
cp ml-service/career_xgboost_model.pkl /path/to/your/model  # drop your real model in
docker compose up -d --build
docker compose exec backend npm run db:migrate
docker compose exec backend npm run seed   # optional demo data
```

Backend is now on `http://localhost:5001`, ML service on `:8000`, Postgres on `:5432`.

### Option B — Run locally with npm

```bash
# 1. Start Postgres however you like, e.g.:
docker run -d --name career-pg -p 5432:5432 \
  -e POSTGRES_USER=career_admin -e POSTGRES_PASSWORD=career_pass -e POSTGRES_DB=career_guidance \
  postgres:16-alpine

# 2. Configure
cd backend
cp .env.example .env   # edit if your Postgres creds differ

# 3. Install, migrate, seed
npm install
npm run db:generate    # only needed after you change schema.ts
npm run db:migrate
npm run seed            # creates admin@cdac.demo / Password123! + 2 demo mentors + 3 courses

# 4. Run
npm run dev              # http://localhost:5001
```

### Point the frontend at it

In the root project's environment:

```
CAREER_MODEL_URL=http://localhost:8000/predict   # or http://localhost:5001/api/predict/:assessmentId once you wire the frontend through the Node server instead of calling FastAPI directly
```

**The frontend is wired to this backend.** `src/lib/app-store.tsx` calls
these routes directly (via `src/lib/api-client.ts`, base URL from
`VITE_API_URL`) for: registration/login (real JWTs, replacing the old
fake local sign-in), the assessment record + conversation log, saving
final predictions, the mentor directory, and the full session
(request/confirm/reschedule/cancel) workflow. `activity`, `savedCourses`
and `completedSteps` are the only pieces still kept in localStorage —
they're pure UI convenience state with no backend table to persist them
into, not part of the SDD schema.

**One thing that's deliberately *not* rewired:** the actual LLM interview
and ML prediction call still go straight from the frontend's
`career-engine.server.ts` to your ML service / LLM (that already worked
and is tested — see the root README's "LLM and ML integration" section).
The backend's own `POST /api/predict/:id` (which also calls the ML
service) exists as an alternative entry point for a client that talks to
this backend exclusively — e.g. a future mobile app — but the web frontend
currently uses `POST /api/assessments/:id/results` instead, which just
*persists* predictions the frontend already computed, rather than
computing them a second time.

## API surface

All routes are prefixed `/api`. Auth: `Authorization: Bearer <token>` from `/auth/login` or `/auth/register`.

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | creates user (+ mentor row if role=mentor) |
| POST | `/auth/login` | — | |
| GET/PUT | `/profile/me` | student+ | student_profiles |
| POST | `/assessments/start` | any | |
| POST | `/assessments/:id/message` | any | append to conversation_log |
| POST | `/assessments/:id/complete` | any | |
| GET | `/assessments` | any | with results |
| POST | `/assessments/:id/results` | any | persists already-computed predictions (what the frontend uses) |
| POST | `/predict/:assessmentId` | any | calls ml-service itself, persists career_results |
| GET | `/mentors` | any | `?career=` filter |
| GET/PUT | `/mentors/me` | mentor | |
| PUT | `/mentors/me/slots` | mentor | availability picker |
| GET | `/courses` | any | `?career=` filter |
| POST | `/courses` | admin | |
| GET/POST | `/connections` | any | session requests |
| POST | `/connections/:id/confirm` \| `/decline` \| `/cancel` \| `/propose-reschedule` \| `/respond-reschedule` | mentor/student | full session workflow |
| POST | `/reports/:resultId` | any | creates shareable report |
| GET | `/reports/shared/:token` | — | public, no auth |
| GET | `/admin/users` \| `/admin/stats` \| `/admin/logs` | admin | |
| PATCH | `/admin/users/:id` | admin | activate/deactivate/change role |

## Verified working (2026-07-26, updated 2026-07-27)

Ran the full flow against a live Postgres + FastAPI ml-service in the build
environment: register → login → update profile → start assessment → post
conversation message → `/predict` (real HTTP round-trip to ml-service,
results persisted to `career_results`) → list mentors → request session →
mentor proposes reschedule → student accepts → status flips to `accepted`
with the new slot → admin stats/users/logs all return real data. All 9
tables created correctly via `drizzle-kit migrate`.

Follow-up session (frontend wiring): also verified `POST
/assessments/:id/results` (the endpoint the frontend actually calls after
computing predictions), mentor profile updates via the new
`title`/`company`/`linkedinUrl` fields showing correctly in `GET
/mentors`, and — after finding and fixing a bug where the mentor-side
session queue showed the mentor's own name instead of the requesting
student's — confirmed `GET /connections` now returns the correct
`studentName`/`mentorName` depending on which side is asking. CORS
preflight from `http://localhost:3000` (the frontend's default dev origin)
also confirmed working.
