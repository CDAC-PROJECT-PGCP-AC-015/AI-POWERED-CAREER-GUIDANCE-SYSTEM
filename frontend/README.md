# Frontend — AI Powered Career Guidance System

React + TanStack Start. This is the only surface the user interacts with; it
also hosts the server-only functions that call your LLM and ML model
directly (`src/lib/career-engine.server.ts`) — see the root `README.md` for
how that fits together with `../backend` and `../ml-service`.

## Run it

```bash
npm install
cp .env.example .env   # fill in VITE_API_URL, CAREER_MODEL_URL, LLM_API_KEY, etc.
npm run dev             # http://localhost:3000
```

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — production build (also type-checks and regenerates the route tree)
- `npm run lint` — ESLint

## Structure

- `src/routes/` — file-based pages (dashboard, assessment, guidance, mentor portal, admin, ...)
- `src/lib/app-store.tsx` — shared client state; calls `../backend`'s REST API for anything durable
- `src/lib/api-client.ts` — small fetch wrapper (adds the JWT bearer token) used by app-store
- `src/lib/career-engine.server.ts` — **server-only**; calls your LLM and ML model (see file header comment)
- `src/lib/career-data.ts` — types + the 3 hand-curated demo careers used as a fallback
- `src/components/ui-kit.tsx` — shared design-system primitives used across routes
