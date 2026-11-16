# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY core ./core
COPY tests ./tests
COPY server ./server
COPY electron/worker.cjs ./electron/worker.cjs
COPY index.html tsconfig.json vite.config.ts vitest.config.ts ./
RUN npm test && npm run build

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY core ./core
COPY server ./server
COPY electron/worker.cjs ./electron/worker.cjs
COPY package.json LICENSE THIRD_PARTY_NOTICES.md ./
COPY vendor-licenses ./vendor-licenses
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:4173/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server/server.cjs"]
