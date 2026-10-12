# syntax=docker/dockerfile:1

# Node 22+ is required: the app uses the built-in node:sqlite module for bookings and call logs.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs appuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.mjs ./server.mjs
# Modules imported by server.mjs (booking engine and voice tool definitions)
COPY --from=builder /app/lib/reservations.mjs /app/lib/voiceTools.mjs ./lib/
# Restaurant configuration read at runtime (and rewritten when the owner publishes)
COPY --from=builder /app/owner_config.json /app/menu_matrix.json /app/floor_graph.json ./

# The app writes its SQLite database to /app/data (mounted as a volume) and the
# owner's published config to /app/*.json, so the app user must own them.
RUN mkdir -p /app/data && chown -R appuser:nodejs /app/data /app/owner_config.json /app/menu_matrix.json /app/floor_graph.json

USER appuser
EXPOSE 3000
CMD ["node", "server.mjs"]
