# --- Build stage ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

# VITE_API_URL is a build-time value (Vite inlines import.meta.env.* into the
# bundle) — pass it as a build ARG, not a runtime env var. Default assumes
# Caddy reverse-proxies /api on the SAME domain as the frontend (see
# ../Caddyfile), so a relative path is normally correct and CORS never
# comes into play. Override with --build-arg if you're hosting the API on a
# different origin.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# The vite-tanstack-config wrapper defaults nitro to a Cloudflare Workers
# build, which can't run via plain `node`. NITRO_PRESET forces a standard
# Node server build instead (verified: emits .output/server/index.mjs with
# preset "node-server" in .output/nitro.json).
ENV NITRO_PRESET=node-server
RUN npm run build

# --- Runtime stage ---
FROM node:22-slim
WORKDIR /app
COPY --from=build /app/.output ./.output
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
