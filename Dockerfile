# syntax=docker/dockerfile:1
# Une seule image : le serveur Node sert le jeu (build Vite) et héberge la partie en ligne.

FROM node:24-bookworm-slim AS base
WORKDIR /app

# git : limperiam-auth-client s'installe depuis GitHub et se compile à l'installation.
FROM base AS with-git
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

# ---- deps (dev incluses, nécessaires au build) ----
FROM with-git AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- build du client ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- deps de prod uniquement ----
FROM with-git AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
RUN groupadd -r app && useradd -r -g app app \
    && mkdir -p /data && chown -R app:app /data

COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
# Le serveur exécute la même simulation que le navigateur : il lui faut src/.
COPY --chown=app:app package.json ./
COPY --chown=app:app server/index.js ./server/index.js
COPY --chown=app:app src ./src

USER app
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --start-interval=2s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
