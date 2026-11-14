# Multi-stage: build web, then run API (tsx) serving the static web build.
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @kitestall/web build

FROM node:22-bookworm-slim
RUN corepack enable
ENV NODE_ENV=production PORT=8787 DATABASE_PATH=/data/kitestall.db
WORKDIR /app
COPY --from=build /app /app
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "--filter", "@kitestall/api", "start"]
