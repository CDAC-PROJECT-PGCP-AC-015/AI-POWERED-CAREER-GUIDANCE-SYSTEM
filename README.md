# CareerAI — AI-Powered Career Guidance System

An AI-driven career guidance platform built for engineering students: a conversational
assessment, a trained machine-learning model predicting the top-3 best-fit careers out of 31
tech roles, LLM-generated guidance grounded in real data, and a full mentor/course/session
workflow — all backed by a real PostgreSQL database.

**Live app:** https://career-guidance.ai-career-guidance.workers.dev/
**Repository:** https://github.com/CDAC-PROJECT-PGCP-AC-015/AI-POWERED-CAREER-GUIDANCE-SYSTEM

---

## Table of contents

- [What this project does](#what-this-project-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Features](#features)
- [Project structure](#project-structure)
- [How the ML model works](#how-the-ml-model-works)
- [How the LLM is used](#how-the-llm-is-used)
- [API overview](#api-overview)
- [Database schema](#database-schema)
- [Live deployment](#live-deployment)
- [Running it locally](#running-it-locally)
- [Environment variables](#environment-variables)
- [Reliability & fallback design](#reliability--fallback-design)
- [Known limitations](#known-limitations)
- [License](#license)

---

## What this project does

A student signs up, fills in their academic background (stream, specialization, 10th/12th marks,
graduation CGPA), and goes through a 15-question conversational AI interview. From that, the
system:

1. Predicts the student's **top 3 career fits** out of 31 tech careers using a **trained XGBoost
   classifier** — a real model, not an LLM guess.
2. Uses an **LLM** to turn the free-text interview into structured features for that model, and
   to generate a natural-language summary, a 5-phase roadmap, and a skill-gap breakdown for each
   predicted career.
3. Grounds every "real-world" claim — companies hiring, courses to take, mentors to talk to, live
   job openings — in **actual data**: a real mentor directory in the database, or live web search.
   The LLM is never allowed to invent a mentor, company, or course out of thin air.
4. Lets students book real mentors, message them, track a roadmap, and retake the assessment as
   their profile changes.
5. Gives mentors and admins their own dashboards (session management, student rosters, reports).

---

## Architecture

The system is split into **four independently deployable services**, each doing one job:

```
                    ┌─────────────────────┐
                    │      Frontend        │
                    │  React + TanStack     │
                    │  Start (Cloudflare     │
                    │       Workers)         │
                    └──────────┬────────────┘
                               │ REST (JWT auth)
                               ▼
                    ┌─────────────────────┐        ┌──────────────────┐
                    │      Backend          │───────▶│   PostgreSQL      │
                    │ Node.js + Express      │◀───────│   (Neon, managed)  │
                    │      (Render)          │        └──────────────────┘
                    └──────────┬────────────┘
                               │ live job/course/company search
                               ▼
                    ┌─────────────────────┐
                    │       Tavily          │
                    │   (web search API)     │
                    └─────────────────────┘

  Frontend also calls, directly and server-side only:

                    ┌─────────────────────┐        ┌──────────────────┐
                    │      ML Service        │        │   LLM Provider     │
                    │ Python + FastAPI       │        │ OpenRouter (primary)│
                    │ + XGBoost (Render)      │        │  → Groq (fallback)  │
                    └─────────────────────┘        └──────────────────┘
```

**Why this split instead of one monolith?**
- The **ML model** needs Python's data-science stack (XGBoost, pandas, scikit-learn) — the rest
  of the app is TypeScript, so it's isolated as its own small FastAPI service.
- The **backend** owns the database and all persisted "real" data — nothing else touches
  Postgres directly.
- The **frontend** hosts the user-facing app *and* the LLM/ML integration code, using TanStack
  Start's server functions (see [How the LLM is used](#how-the-llm-is-used)) — the safest place
  to keep those API keys close to where they're actually used.
- **Tavily** (web search) is a separate concern neither the LLM nor the ML model can do alone.

If any one service is slow or down, the others degrade gracefully instead of the app breaking —
see [Reliability & fallback design](#reliability--fallback-design).

---

## Tech stack

### Frontend
| Technology | Why |
|---|---|
| **React 19** | Component model for the whole UI |
| **TanStack Start** | Meta-framework providing file-based routing (TanStack Router) *and* server functions — lets server-only code (LLM/ML calls, API keys) live in the same codebase as the UI, called like a normal async function, with zero risk of keys leaking to the browser |
| **TypeScript** | Type safety across the whole frontend, including the server functions |
| **Tailwind CSS v4** | Utility-first styling, full design control |
| **Radix UI primitives** | Accessible, unstyled interaction components (dialogs, tabs, dropdowns) |
| **Vite** | Dev server & build tool |
| **Recharts** | Charts (skill gaps, progress) |
| **Zod + React Hook Form** | Form validation |
| **Deployed via** | Nitro's Cloudflare Workers preset — edge-deployed, zero cold start for the UI shell |

### Backend
| Technology | Why |
|---|---|
| **Node.js + Express** | Straightforward REST API — no need for a heavier framework at this scope |
| **TypeScript** | End-to-end type safety |
| **Drizzle ORM** | Thin, type-safe SQL layer — TypeScript infers row types directly from schema, fast `drizzle-kit push` migration workflow, queries stay close to real SQL for easy debugging |
| **PostgreSQL** | Real relational integrity for users ↔ mentors ↔ assessments ↔ results ↔ connections |
| **jsonwebtoken + bcryptjs** | Stateless JWT auth, salted password hashing |
| **Zod** | Request-body validation on every route |
| **Deployed via** | Render (Node web service) |

### ML Service
| Technology | Why |
|---|---|
| **Python** | The data-science ecosystem lives here |
| **XGBoost** | Gradient-boosted tree classifier — see [How the ML model works](#how-the-ml-model-works) for why this specific algorithm |
| **pandas / NumPy** | Feature engineering (~500 features: numeric, one-hot categorical, one-hot multi-label) |
| **scikit-learn** | Train/test split, label encoding, evaluation metrics |
| **FastAPI + Uvicorn** | Serves `/predict`, `/health`, `/vocab`, `/reload` |
| **joblib** | Persists the trained model artifact (booster + encoders + vocabularies) as a single file |
| **Deployed via** | Render (Python web service) |

### LLM & live data
| Technology | Why |
|---|---|
| **OpenRouter** (primary) | OpenAI-compatible `/chat/completions` endpoint — model-agnostic, easy to swap |
| **Groq** (automatic fallback) | If OpenRouter errors/times out, the exact same request retries here automatically — one shared function protects every LLM feature at once |
| **Tavily** | Web search API for live job postings, courses, and companies currently hiring — restricted to a curated list of trusted domains |

### Database
| Technology | Why |
|---|---|
| **Neon** | Serverless PostgreSQL with a real free tier and branching — cheap to run continuously for a student project |

### DevOps
| Technology | Why |
|---|---|
| **Docker Compose** | Full local/dev stack (`docker-compose.yml`) and a production stack with Caddy for automatic HTTPS (`docker-compose.prod.yml`) |
| **Caddy** | Reverse proxy + automatic TLS certs for the Docker production path |
| **Cloudflare Workers / Render / Neon** | The free-tier, no-Docker deployment path actually used for the live demo (see [Live deployment](#live-deployment)) |

---

## Features

**Student**
- Onboarding (stream, year, specialization, 10th/12th marks, graduation CGPA)
- 15-question conversational AI assessment
- Top-3 career predictions with confidence scores, salary ranges, and market demand
- AI-generated summary, 5-phase roadmap, and skill-gap analysis per career
- Matched companies, live job openings (real-time search), recommended courses
- Mentor discovery, booking, and in-app messaging
- Skill Lab — aggregated course recommendations across all predicted careers, with bookmarking
- Activity log, editable profile in Settings, retake-assessment flow

**Mentor**
- Mentor Portal (availability management)
- Session list and student roster (My Students)

**Admin**
- Institution-wide reports
- Student roster management

---

## Project structure

```
AI-POWERED-CAREER-GUIDANCE-SYSTEM/
├── frontend/                 React + TanStack Start
│   └── src/
│       ├── routes/           File-based pages (onboarding, assessment, results, ...)
│       ├── lib/
│       │   ├── career-engine.server.ts   ← LLM + ML integration (server-only)
│       │   ├── career.functions.ts       ← Server functions exposed to the client
│       │   ├── career-data.ts            ← Shared types + curated fallback content
│       │   └── app-store.tsx             ← Global client state (React Context)
│       └── components/
├── backend/                  Node.js + Express + Drizzle
│   └── src/
│       ├── routes/            auth, profile, assessments, mentors, courses,
│       │                      jobs, discover, connections, messages, admin
│       ├── db/                 schema.ts, client.ts
│       └── seed/                demo data seeding
├── ml-service/                Python + FastAPI
│   ├── app.py                  /predict, /health, /vocab, /reload
│   └── career_xgboost_model.pkl
├── docker-compose.yml          Local dev stack
├── docker-compose.prod.yml      Production stack (with Caddy)
├── DEPLOY.md                    Docker deployment guide
├── DEPLOY_FREE.md                Free-tier (Cloudflare + Render + Neon) deployment guide
└── .env.example
```

---

## How the ML model works

**The problem:** multi-class classification — 31 career classes, ~500 engineered features per
student profile (numeric marks/CGPA/ratings, one-hot categorical fields like education level and
specialization, one-hot multi-label fields like tech skills, soft skills, interests, and
certifications).

**The dataset:** since no real placement outcome data exists yet, the model trains on a
**synthetic dataset** (~15,500 profiles, 500 per career) generated from hand-written career
archetypes — each with a realistic skill/interest/certification pool. The generator deliberately
adds **skill borrowing** (a Data Scientist profile sometimes draws from the closely related
Machine Learning Engineer pool) and **cross-domain noise**, so the model has to learn genuinely
overlapping, realistic boundaries rather than a trivially separable dataset.

**Why XGBoost:**
- Tree-based gradient boosting is the established strong performer on structured/tabular data of
  this size and shape — better suited here than a neural network (which would need far more data)
  and better at capturing non-linear feature interactions than a linear model.
- It natively handles missing values (e.g. `postgrad_cgpa` is usually absent for UG students) and
  sparse one-hot features without extra preprocessing.
- Critically, it exposes raw **pre-softmax margins** (`output_margin=True`), which the whole
  fit-score design below depends on — most other model types (Random Forest, for instance) don't
  expose an equivalent value.

**Why not just use `predict_proba()` directly:** standard softmax output is *forced* to sum to
100% across all 31 classes, which artificially drags down a genuinely strong second- or
third-place fit just because the top pick is also strong. Instead, this project pulls XGBoost's
raw margins and scales **each class independently** against its own calibrated range, so a
profile can legitimately score 90% on one career and 85% on another without them competing for a
fixed pie.

**Calibration:** each class's "100%" anchor is the **88th percentile** of margins among that
class's true members in training (not the literal single highest margin ever seen, which proved
too conservative in practice) — this was verified on held-out test data to meaningfully raise
typical confidence scores while preserving the gap between correct and incorrect predictions.

**Performance:** ~98% top-1 accuracy, ~100% top-3 accuracy on held-out synthetic test data.

**Serving:** `ml-service/app.py` (FastAPI) loads the trained artifact and exposes `/predict`,
`/health`, `/vocab` (the model's exact trained vocabulary, used to ground the LLM's feature
extraction — see below), and `/reload` (hot-swap a newly trained model without redeploying).

---

## How the LLM is used

Every LLM call in the app goes through **one shared function** with automatic failover: primary
provider **OpenRouter**, falling back to **Groq** transparently if the primary errors or times
out. It does four distinct jobs:

1. **Conversational interviewer** — asks the 15 assessment questions with natural
   acknowledgments of each answer (falls back to template acknowledgments if no LLM is
   configured, so the assessment still works with zero LLM setup).
2. **Structured feature extraction** — after the interview, one call reads the full transcript
   and extracts `skills_tech`, `skills_soft`, `interests`, `certifications`, and internship
   details for the ML model — **constrained to the model's real trained vocabulary** (fetched
   live from `/vocab`), so nothing the LLM outputs gets silently dropped as unrecognized. Marks
   and CGPA are collected directly as exact numbers on the onboarding form — no LLM needed there.
3. **Career enrichment** — for each of the top-3 predicted careers, generates the AI summary,
   5-phase roadmap, and skill-gap breakdown.
4. **Grounded mentor selection** — given the **real list of mentors** from the database (id,
   name, title, expertise), the LLM can only pick relevant ones **by ID**. It's explicitly
   instructed to return an empty list rather than invent a mentor — this is the system's most
   important anti-hallucination guardrail.

**The broader pattern:** let the LLM draft, then override with real data wherever real data
exists. Companies and courses the LLM proposes get replaced by live Tavily search results when
available; mentors are never LLM-generated at all; live job openings are always a real-time
search, never an LLM guess.

---

## API overview

All routes are prefixed `/api` and require a JWT bearer token except auth endpoints. Grouped by
resource:

| Router | Handles |
|---|---|
| `auth` | Register, login, token issuance |
| `profile` | Student academic profile (stream, marks, CGPA, skills, interests) |
| `assessments` | Start an assessment, save answers, save/fetch top-3 results |
| `predict` | Alternative direct-prediction entry point (e.g. for a future mobile client) |
| `mentors` | Mentor directory, availability, matching by career |
| `courses` | Curated course catalogue |
| `jobs` | Live job-posting search per company (Tavily) |
| `discover` | Live course & "companies currently hiring" search (Tavily) |
| `connections` | Student ↔ mentor booking/connection records |
| `messages` | In-app messaging between a connected student and mentor |
| `admin` | Institution-wide reports, student roster (admin role only) |

---

## Database schema

| Table | Purpose |
|---|---|
| `users` | Auth + role (`student` / `mentor` / `admin`) |
| `studentProfiles` | Academic fields, skills, interests, roadmap progress |
| `assessments` | One row per attempt (status, timestamps) |
| `careerResults` | Up to 3 rows per completed assessment (rank, predicted career, fit score, narrative) |
| `mentors` | Mentor-specific fields (title, company, expertise tags, availability) |
| `connections` | Student ↔ mentor relationships |
| `messages` | Chat messages tied to a connection |
| `courses` | Curated course catalogue |

---

## Live deployment

| Service | URL | Hosted on |
|---|---|---|
| Frontend | https://career-guidance.ai-career-guidance.workers.dev/ | Cloudflare Workers |
| Backend API | https://ai-powered-career-guidance-system-2.onrender.com | Render |
| ML Service | https://ai-powered-career-guidance-system-1.onrender.com | Render |
| Database | *(Neon, managed PostgreSQL — connection string kept private, never committed)* | Neon |

> **Note on cold starts:** the backend and ML service run on Render's free tier, which spins
> services down after ~15 minutes of inactivity. The first request after idle time can take
> 30–60 seconds (especially the ML service, which loads pandas/XGBoost and a multi-MB model file
> on boot). The app proactively "wakes up" the ML service as early as onboarding to hide most of
> this behind the time a student naturally spends filling in the assessment — see
> [Reliability & fallback design](#reliability--fallback-design).

Full step-by-step deployment instructions for this exact free-tier path are in
[`DEPLOY_FREE.md`](./DEPLOY_FREE.md). A Docker-based path (for a VPS or local server) is in
[`DEPLOY.md`](./DEPLOY.md).

---

## Running it locally

```bash
# 1. Bring up Postgres + ml-service + backend
docker compose up -d --build
docker compose exec backend npm run db:push
docker compose exec backend npm run seed      # optional demo data

# 2. Run the frontend
cd frontend
cp .env.example .env      # fill in VITE_API_URL, CAREER_MODEL_URL, LLM_API_KEY...
npm install
npm run dev                # http://localhost:3000
```

See [`backend/README.md`](./backend/README.md) and [`ml-service/README.md`](./ml-service/README.md)
for the fully manual (no Docker) setup of each service.

---

## Environment variables

Real values are **never committed** — see each `.env.example` for the full list with comments.
The important ones, and *where* they're set:

| Variable | Set on | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | Postgres connection string |
| `JWT_SECRET` | Backend | Signs auth tokens |
| `CAREER_MODEL_URL` | Frontend *and* backend | ML service's `/predict` URL |
| `TAVILY_API_KEY` | Backend | Live job/course/company search |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | Frontend | Primary LLM (OpenRouter) |
| `LLM_FALLBACK_API_KEY` / `LLM_FALLBACK_BASE_URL` / `LLM_FALLBACK_MODEL` | Frontend | Secondary LLM (Groq) |
| `BACKEND_API_URL` | Frontend | Lets the frontend's server functions reach the backend (real mentor directory, live search) |
| `VITE_API_URL` | Frontend (build-time) | Where the browser calls the backend from |

---

## Reliability & fallback design

Every external dependency has a defined fallback, so a slow or unavailable service degrades the
experience rather than breaking it:

| If this is down/slow | This happens instead |
|---|---|
| ML model unreachable | Falls back to a small set of hardcoded demo predictions |
| Both LLM providers unreachable | Template-based interview acknowledgments; generic (non-personalized) career write-ups |
| Tavily unconfigured / no results | Falls back to a generic job-board/course-provider search link |
| Backend mentor fetch fails | Enrichment proceeds with zero mentors rather than failing the whole prediction |

---

## Known limitations

- The ML model is trained on **synthetic**, not real outcome, data — reported accuracy is
  against that synthetic benchmark, not real student placement results.
- LLM-extracted signals can vary slightly between runs of the *same* transcript, since LLM
  sampling isn't perfectly deterministic — an explicit tradeoff of putting an LLM in the loop.
- Mentor availability depends entirely on which mentors are registered — a career the model can
  predict may still show zero mentors if none have signed up for that specialty.
- Render's free tier means cold-start latency is a real, ongoing constraint, mitigated (not
  eliminated) by proactive warm-up.

---

## License

No license file is currently included in this repository. Add a `LICENSE` file (MIT is a common
default for student/portfolio projects) if you intend for this to be reused beyond the CDAC
project submission.
