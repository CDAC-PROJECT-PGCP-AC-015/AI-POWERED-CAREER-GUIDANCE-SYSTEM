# Deploying CareerAI

> **Want free hosting with no Docker?** See [`DEPLOY_FREE.md`](./DEPLOY_FREE.md)
> instead (Neon + Render + Cloudflare Workers). This guide is for a paid VPS
> running everything via Docker Compose — more control, one server to manage,
> no cold starts.

This deploys everything — Postgres, the ML service, the backend API, and the
frontend — on a single server behind Caddy, which handles HTTPS
automatically. Total cost: just the server (a $6/mo VPS is plenty for a
demo/small-cohort deployment).

## 0. What you'll need

- A domain name (or subdomain) you can point at a server — e.g. `careerai.yourdomain.com`.
- A VPS. Any of these work fine: [Hetzner](https://hetzner.com) (cheapest),
  [DigitalOcean](https://digitalocean.com), [Linode](https://linode.com). Pick
  the smallest Ubuntu 24.04 box — 2GB RAM is enough.
- 15 minutes.

---

## 1. Point your domain at the server

1. Spin up the VPS, note its public IP address.
2. In your DNS provider, add an **A record**: `careerai` (or `@` for the bare
   domain) → the server's IP address.
3. Wait for it to propagate (`dig careerai.yourdomain.com` should show the
   IP — usually takes a few minutes, occasionally longer).

You need this working *before* starting containers in step 4, because Caddy
requests a real HTTPS certificate on first boot and that requires your
domain to already resolve to the server.

## 2. Install Docker on the server

SSH into the server, then:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in for the group change to apply
```

## 3. Get the code onto the server

Either `git clone` your repo, or upload the project folder directly, e.g.
from your own machine:

```bash
scp -r "ai-career-guidance-system - Copy" youruser@your-server-ip:~/careerai
```

Then on the server:

```bash
cd ~/careerai
```

Make sure `ml-service/career_xgboost_model.pkl` (the trained model file) is
actually present — it's large and sometimes gets excluded by `.gitignore` or
upload tools that skip big binaries. Check with `ls -lh ml-service/`.

## 4. Configure secrets

```bash
cp .env.example .env
nano .env   # or vim, whatever you've got
```

Fill in:

```bash
DOMAIN=careerai.yourdomain.com
JWT_SECRET=<paste output of: openssl rand -base64 48>
POSTGRES_PASSWORD=<pick a real password, not "career_pass">
```

`LLM_API_KEY` (OpenRouter), `LLM_FALLBACK_API_KEY` (Groq — used automatically
if OpenRouter fails), and `TAVILY_API_KEY` are all optional — leave them
blank and those features (AI-written assessment summaries, structured ML
feature extraction, live job/course/company links) just fall back to
non-AI/non-live behavior instead of failing.

## 5. Bring everything up

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First run takes a few minutes (building the frontend, backend, and ML
service images). Watch it with:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Caddy will request the HTTPS certificate automatically on its first
request — if `caddy` logs show certificate errors, it's almost always the
DNS from step 1 not having propagated yet, or port 80/443 being blocked by
a firewall (see Troubleshooting below).

## 6. Set up the database

```bash
docker compose -f docker-compose.prod.yml exec backend npm run db:push
docker compose -f docker-compose.prod.yml exec backend npm run seed
```

`db:push` may ask you to confirm creating tables/columns — say yes to
additions, and there's nothing to say no to on a first run.

`seed` only ever creates **1 admin account, 93 mentor accounts (3 per real
career the ML model predicts), and a handful of starter courses** — it
never creates student accounts, session requests, messages, or assessment
history. So as long as you're seeding a genuinely empty database (a fresh
volume, not one you'd already been testing against), you'll end up with
exactly that and nothing else: no leftover test students, no old demo
sessions. If you're redeploying over a volume you already used for local
testing, wipe it first:

```bash
docker compose -f docker-compose.prod.yml down -v   # ⚠️ deletes all data — only for a truly fresh start
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend npm run db:push
docker compose -f docker-compose.prod.yml exec backend npm run seed
```

**First login**: `admin@cdac.demo` / `Password123!`. Every seeded mentor
uses that same password too (see `backend/src/seed/seed.ts` for the exact
emails, or check the Admin dashboard's Recent Users table). Immediately
after logging in as admin:

1. Go to **Settings → Change password** and set a real password on this
   admin account (there's now an in-app password-change flow — no need to
   edit the seed script).
2. If you want a personal admin account instead of using the shared seeded
   one, go to the **Admin dashboard → Create account**, make yourself an
   admin with your own email/password, and stop using the seeded one going
   forward (you can deactivate it via the Recent Users table's role/status
   controls, or just leave it — it has no student data attached to leak).

The 93 seeded mentor accounts sharing one password is fine to leave as-is —
they're illustrative demo mentors, not real people signing in.

## 7. Visit it

`https://careerai.yourdomain.com` — you should land on the CareerAI landing
page over a valid HTTPS connection.

---

## Updating after a code change

```bash
cd ~/careerai
git pull   # or re-upload changed files
docker compose -f docker-compose.prod.yml up -d --build
# only if you changed backend/src/db/schema.ts:
docker compose -f docker-compose.prod.yml exec backend npm run db:push
```

## Backing up the database

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U career_admin career_guidance > backup-$(date +%F).sql
```

Restore with:

```bash
cat backup-2026-07-31.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U career_admin career_guidance
```

## Troubleshooting

- **Caddy can't get a certificate** — check `dig yourdomain.com` resolves to
  the server's IP, and that your cloud provider's firewall (not just the
  server's own `ufw`/`iptables`) allows inbound 80 and 443.
- **502 from Caddy** — the frontend or backend container isn't up yet, or
  crashed. `docker compose -f docker-compose.prod.yml ps` to see status,
  then `docker compose -f docker-compose.prod.yml logs backend` (or
  `frontend`) for the actual error.
- **`npm run seed` / `db:push` says "command not found"** — you're running
  it against the wrong compose file / an old image; rebuild with
  `--build` first (step 5 fixed a gap where the backend's production image
  didn't include the dev tools those commands need — make sure you're on
  the latest `backend/Dockerfile`).
- **ML predictions failing** — check `ml-service/career_xgboost_model.pkl`
  actually made it onto the server and isn't a 0-byte/corrupted file
  (`ls -lh`, should be several MB).
- **Login works but every page 401s** — `JWT_SECRET` probably differs
  between the container that issued the token and the one validating it;
  this happens if you changed `.env` and restarted only some containers.
  `docker compose -f docker-compose.prod.yml up -d --build` restarts
  everything consistently.

## What's NOT exposed publicly

`docker-compose.prod.yml` deliberately does not publish ports for
`postgres` (5432) or `ml-service` (8000) to the host — they're only
reachable from other containers on the compose network. Only Caddy (80/443)
is public; it proxies `/api/*` to the backend and everything else to the
frontend (see `Caddyfile`).

For direct DB access:

- **Quick CLI look**: `docker compose -f docker-compose.prod.yml exec postgres psql -U career_admin -d career_guidance` — works with no port published, since `exec` runs inside the container.
- **A GUI tool (DBeaver, TablePlus, etc.)**: postgres has no host port to tunnel to by default, so temporarily add one bound to loopback only, e.g. in a `docker-compose.override.yml`:
  ```yaml
  services:
    postgres:
      ports:
        - "127.0.0.1:5432:5432"
  ```
  then `docker compose -f docker-compose.prod.yml -f docker-compose.override.yml up -d postgres`, and from your own machine:
  ```bash
  ssh -L 5432:localhost:5432 youruser@your-server-ip
  ```
  Point your DB tool at `localhost:5432`. Remove the override (and restart) when you're done — don't leave it running.
