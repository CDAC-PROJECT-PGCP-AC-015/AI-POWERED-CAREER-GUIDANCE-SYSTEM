# Deploying CareerAI for free, without Docker

Three free platforms, no server to manage, no Docker:

| Piece          | Platform                              | Why                                                                 |
| --------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Database        | [Neon](https://neon.tech)              | Free serverless Postgres, generous free tier                       |
| Backend + ML    | [Render](https://render.com)           | Free web services, native Node/Python runtime — no Dockerfile used |
| Frontend        | [Cloudflare Workers](https://workers.cloudflare.com) | This project's build already targets Cloudflare by default — genuinely the path of least resistance |

**Honest tradeoff**: Render's free tier spins a service down after 15
minutes of no traffic. The *first* request after that (someone predicting a
career, or the backend waking up) takes 30–60 seconds while it cold-starts.
Neon's free compute also auto-suspends but wakes in under a second, so it's
rarely noticeable. Cloudflare Workers has no cold start at all. Fine for a
personal project, portfolio piece, or small cohort — not what you'd want
for a paid product with real usage.

You'll need a GitHub account (both Render and Cloudflare deploy from a
repo), and none of these should ask for a credit card on their free tiers.

---

## 1. Push the code to GitHub

```bash
cd "ai-career-guidance-system - Copy"
git init
git add .
git commit -m "Initial commit"
```

Create an empty repo on GitHub, then:

```bash
git remote add origin https://github.com/yourname/careerai.git
git push -u origin main
```

**Double check the model file made it in** — `git ls-files ml-service/*.pkl`
should list `career_xgboost_model.pkl`. (It was previously excluded by
`.gitignore`; this is already fixed in this codebase, but worth confirming
after your first push since it's an easy silent failure — the ML service
will build and start fine even with the model missing, it just returns
errors on every prediction request.)

## 2. Database — Neon

1. Sign up at [neon.tech](https://neon.tech), create a project.
2. On the project dashboard, copy the **connection string** — looks like:
   ```
   postgresql://neondb_owner:AbC123@ep-cool-name-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Keep this tab open, you'll paste it into Render in step 4.

## 3. ML service — Render

1. On [render.com](https://render.com), **New → Web Service**, connect your
   GitHub repo.
2. **Root directory**: `ml-service`
3. **Runtime**: Python 3
4. **Build command**: `pip install -r requirements.txt`
5. **Start command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
6. **Instance type**: Free
7. Create the service. Once deployed, copy its URL, e.g.
   `https://careerai-ml.onrender.com` — you'll need it in the next step.

## 4. Backend — Render

1. **New → Web Service** again, same repo.
2. **Root directory**: `backend`
3. **Runtime**: Node
4. **Build command**: `npm install && npm run build`
5. **Start command**: `npm start`
6. **Instance type**: Free
7. **Environment variables** (Render's dashboard, not a `.env` file):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 2 |
   | `JWT_SECRET` | output of `openssl rand -base64 48` |
   | `JWT_EXPIRES_IN` | `24h` |
   | `CAREER_MODEL_URL` | `https://careerai-ml.onrender.com/predict` (your ml-service URL from step 3, with `/predict`) |
   | `CORS_ORIGIN` | leave blank for now — you'll set this after step 5 gives you the frontend URL |
   | `TAVILY_API_KEY` | optional — powers live job/course/company search. Leave blank if you don't have one. |

   Note: `LLM_API_KEY` and friends are **not** set here. The LLM calls
   (interview, AI summaries, ML feature extraction) run inside
   `frontend/src/lib/career-engine.server.ts`, which executes on the
   *frontend's* server runtime, not this backend service — see step 5.

8. Create the service, wait for it to deploy, copy its URL, e.g.
   `https://careerai-backend.onrender.com`.

### Set up the database

Render's dashboard has a **Shell** tab on the service page — use it like
you would `docker compose exec`:

```bash
npm run db:push
npm run seed
```

This creates 1 admin account, 93 mentors (3 per real career), and starter
courses — no student data, same as the Docker path (see the note on this in
the main `DEPLOY.md` if you want the detail on why that's guaranteed).

## 5. Frontend — Cloudflare Workers

This project's build defaults to a Cloudflare Workers target already (you
can see this if you just run `npm run build` locally — it generates a
`wrangler.json`), so there's no override needed here, unlike the Docker
path which forces a different target.

1. In `frontend/`, create `.env.production`:
   ```
   VITE_API_URL=https://careerai-backend.onrender.com/api
   ```
   (your actual Render backend URL from step 4, with `/api` on the end —
   Vite bakes this into the build, so it has to be right *before* you build)

2. Log into Cloudflare from the CLI (opens a browser to authorize):
   ```bash
   cd frontend
   npx wrangler login
   ```

3. Set the server-only secrets. Unlike `VITE_API_URL` above, these are read
   at *runtime* by `career-engine.server.ts` (which runs on the Worker, not
   baked into the browser bundle), so they go through `wrangler secret put`
   instead of `.env.production`:

   ```bash
   npx wrangler secret put CAREER_MODEL_URL       # e.g. https://careerai-ml.onrender.com/predict
   npx wrangler secret put CAREER_MODEL_KEY       # optional — press enter to skip
   npx wrangler secret put BACKEND_API_URL        # e.g. https://careerai-backend.onrender.com/api

   # Primary LLM — OpenRouter
   npx wrangler secret put LLM_API_KEY
   npx wrangler secret put LLM_BASE_URL           # e.g. https://openrouter.ai/api/v1
   npx wrangler secret put LLM_MODEL              # e.g. openai/gpt-4o-mini

   # Secondary LLM — Groq, used automatically only if OpenRouter fails
   npx wrangler secret put LLM_FALLBACK_API_KEY
   npx wrangler secret put LLM_FALLBACK_BASE_URL  # e.g. https://api.groq.com/openai/v1
   npx wrangler secret put LLM_FALLBACK_MODEL     # e.g. llama-3.3-70b-versatile
   ```
   Each command prompts you to paste the value, then confirms it was
   uploaded. All of these are optional individually — the app still runs
   with template text / fallback predictions for whichever ones you skip.

4. Build and deploy in one step:
   ```bash
   npx nitro deploy
   ```
   First time, this asks you to confirm a Worker name/subdomain. Once it
   finishes, it prints your live URL — something like
   `https://tanstack-start-ts.yourname.workers.dev`.

**Verify the secrets actually reached the server function**: this specific
nitro↔Cloudflare Workers env-var integration is on a beta release as of
writing, so it's worth checking rather than assuming. After deploying, run
through the assessment once — if the AI summary on your results page reads
like natural written prose (not the generic "was predicted as a strong fit
based on..." fallback template), the secrets are wired up correctly.

**If they didn't come through** (summary still looks like the generic
template even though you set `LLM_API_KEY`): the fallback is to run the
frontend as a **third Render Node service** instead of a Cloudflare Worker,
since Render's plain `environment:`-style env vars are far more
predictable for this than the Workers integration:
- **New → Web Service**, same repo, root directory `frontend`
- **Build command**: `npm install && npm run build`
- **Start command**: `node .output/server/index.mjs` (matches
  `frontend/Dockerfile`'s runtime stage — `npm run build` already forces
  `NITRO_PRESET=node-server` via that same Dockerfile's env var, so set
  `NITRO_PRESET=node-server` as a build-time env var here too)
- Add all the same keys from step 3 above as normal Render **environment
  variables** (not secrets — Render doesn't distinguish), plus
  `VITE_API_URL` set to your backend's `/api` URL
- This loses Cloudflare's zero-cold-start edge deployment, but gains
  Render's straightforward runtime env var handling — same free-tier
  cold-start tradeoff as the backend/ml-service already have.

## 6. Close the loop: CORS

Now that you have the real frontend URL, go back to the **backend** service
on Render → Environment → set:

```
CORS_ORIGIN=https://tanstack-start-ts.yourname.workers.dev
```

(or your custom domain, if you attach one in Cloudflare's dashboard). Save
— Render redeploys automatically on env var changes.

## 7. Done

Visit your Workers URL. Log in with `admin@cdac.demo` / `Password123!`,
then immediately go to **Settings → Change password** (or **Admin
dashboard → Create account** to make yourself a personal admin instead) —
same advice as the Docker deployment guide.

---

## Updating after a code change

```bash
git push                                    # Render redeploys backend/ml-service automatically on push
cd frontend && npm run build && npx nitro deploy   # frontend needs a manual redeploy
```

If you changed `backend/src/db/schema.ts`, run `npm run db:push` again via
Render's Shell tab.

## Troubleshooting

- **First request after idle takes forever** — that's the free-tier cold
  start described at the top, not a bug. A cheap way to reduce how often
  you hit it: a free uptime-monitor service (e.g. UptimeRobot) pinging your
  Render URLs every 10 minutes keeps them warm, though this eats into
  Render's monthly free hours faster.
- **CORS errors in the browser console** — `CORS_ORIGIN` on the backend
  doesn't exactly match the frontend's real URL (protocol and no trailing
  slash matter: `https://x.workers.dev`, not `https://x.workers.dev/`).
- **ML predictions failing** — check the model file actually made it to
  GitHub (see step 1's note), and check Render's logs for the ml-service —
  it logs `[ml-service] loaded model from ...` on successful startup.
- **Predictions seem generic / marks & CGPA don't seem to affect results** —
  the ML service exposes `GET {your-ml-service-url}/vocab` automatically
  (no config needed, derived from `CAREER_MODEL_URL`); visiting it in a
  browser should return JSON lists of skills/interests/etc. If that 404s,
  the deployed ml-service is running an older build — redeploy it.
- **`wrangler login` doesn't open a browser** (e.g. on a headless/remote
  machine) — it prints a URL you can open manually on any device, then
  paste back the resulting code.
