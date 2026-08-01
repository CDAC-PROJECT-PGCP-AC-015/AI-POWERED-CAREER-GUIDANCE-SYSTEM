# AI Powered Career Guidance System

A conversational, ML-backed career guidance platform: an LLM-driven interview,
an XGBoost model predicting the top-3 best-fit careers, and a full
mentor/course/session workflow — persisted to a real PostgreSQL database.

This repo is split into three independently runnable services:

```
ai-career-guidance-system/
├── frontend/     React + TanStack Start — the UI, and the server functions
│                 that call your LLM and ML model directly (see
│                 frontend/src/lib/career-engine.server.ts)
├── backend/      Node.js + Express + PostgreSQL (Drizzle ORM) — auth,
│                 profiles, assessment history, mentors, courses, the
│                 mentor-session workflow, and admin
├── ml-service/   Python + FastAPI — wraps your trained career_xgboost_model.pkl
└── docker-compose.yml   brings up postgres + ml-service + backend together
```

Each folder has its own README with full detail. This file is the map.

## Quick start (Docker for the backend services, npm for the frontend)

```bash
# 1. Drop your trained model in
cp /path/to/your/career_xgboost_model.pkl ml-service/career_xgboost_model.pkl

# 2. Bring up Postgres + ml-service + backend
docker compose up -d --build
docker compose exec backend npm run db:migrate
docker compose exec backend npm run seed      # optional demo data

# 3. Run the frontend
cd frontend
cp .env.example .env      # fill in VITE_API_URL, CAREER_MODEL_URL, LLM_API_KEY...
npm install
npm run dev                # http://localhost:3000
```

See the root of this README's sibling files for the fully manual (no Docker)
path: `backend/README.md` and `ml-service/README.md`.

## Where your LLM and ML model plug in

- **ML model** → `ml-service/` wraps your `.pkl` file behind `POST /predict`.
  Point `frontend/.env`'s `CAREER_MODEL_URL` at it.
- **LLM** → `frontend/src/lib/career-engine.server.ts` calls any
  OpenAI-compatible `/chat/completions` endpoint (Groq, OpenAI, etc.) via
  `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` in `frontend/.env`. This same
  file also has `enrichCareerFully()`, which generates the full rich content
  for each predicted career (summary, path, companies, courses, and mentors
  grounded in your real mentor directory) — see that function's comment for
  the prompt design.

## Why the LLM call lives in `frontend/`, not `backend/`

TanStack Start (the frontend framework) has first-class server-only
functions, which is where this call already lived before the backend
existed. `backend/` focuses on persistence and exposes its own
`POST /api/predict/:id` as an alternative entry point (e.g. for a future
mobile client), but the web app's own assessment flow uses the frontend's
call site. This is documented in more depth in the project report's
Chapter 4 ("As-Implemented Architecture").
