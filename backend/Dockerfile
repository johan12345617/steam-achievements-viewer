# Node is pinned to a patch with the October 2026 security fixes (CVE-2026-111497 and others).
# Bump it when a new Node 22 security release ships.
FROM node:22.23.4-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22.23.4-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p uploads data && chown node:node uploads data
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
