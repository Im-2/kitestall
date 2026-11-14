# Multi-stage: build web, then run the API with tsx (no pnpm at runtime => faster cold start on Render's free plan).
FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm i -g pnpm@12.15.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @kitestall/web build

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=8787 DATABASE_PATH=/tmp/kitestall.db
WORKDIR /app/apps/api
COPY --from=build /app /app
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "src/server.ts"]
