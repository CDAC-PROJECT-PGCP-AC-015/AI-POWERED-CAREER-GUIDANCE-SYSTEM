# --- Build stage ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY tsconfig.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src
RUN npx tsc -p tsconfig.json

# --- Runtime stage ---
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
# NOT --omit=dev: db:push / seed / db:studio (run via `docker compose exec
# backend npm run ...` after deploying) need drizzle-kit, which is a
# devDependency. The extra image size is a fine tradeoff for those commands
# actually working without a separate one-off container.
RUN npm install
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY drizzle.config.ts ./
COPY src ./src

EXPOSE 5001
CMD ["node", "dist/index.js"]
