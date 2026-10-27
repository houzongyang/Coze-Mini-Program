# syntax=docker/dockerfile:1

FROM node:20-bookworm AS build

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile

COPY server ./server
RUN pnpm --filter server build
RUN pnpm --filter server --prod deploy /opt/server

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    LIBREOFFICE_PATH=/usr/bin/libreoffice \
    PYTHON_PATH=/opt/venv/bin/python

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    dumb-init \
    fonts-noto-cjk \
    libreoffice-calc \
    libreoffice-core \
    libreoffice-impress \
    libreoffice-writer \
    python3 \
    python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt \
  && rm /tmp/requirements.txt

WORKDIR /app
COPY --from=build /opt/server/package.json ./package.json
COPY --from=build /opt/server/node_modules ./node_modules
COPY --from=build /workspace/server/dist ./dist

RUN mkdir -p /app/data/uploads \
  && chown -R node:node /app /opt/venv

USER node

VOLUME ["/app/data"]
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
