# syntax=docker/dockerfile:1.7
# WellnessQuest unified production image.
#
# Two-stage build:
#   1. Node builds the Next.js frontend as a static export (out/).
#   2. Python base installs the FastAPI deps; the prod stage copies the backend
#      source and the static bundle, then runs Alembic migrations + uvicorn.
#
# Runtime: FastAPI serves the API at /api/v1, the docs at /docs, and the PWA
# (everything else) from /app/static via StaticFiles. Same-origin — no CORS
# needed between the UI and the API.

ARG PYTHON_VERSION=3.12-slim
ARG NODE_VERSION=22-alpine

# --- Stage 1: build the frontend as a static export
FROM node:${NODE_VERSION} AS frontend-builder
WORKDIR /build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY frontend/package.json ./
RUN pnpm install --no-frozen-lockfile
COPY frontend/ .
ENV NEXT_OUTPUT_MODE=export \
    NEXT_PUBLIC_API_BASE=/api/v1
RUN pnpm build

# --- Stage 2: Python base with backend deps
FROM python:${PYTHON_VERSION} AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*
COPY backend/pyproject.toml ./
RUN pip install --upgrade pip && pip install .

# --- Stage 3: prod image with backend source + static frontend bundle
FROM base AS prod
COPY backend/ .
COPY --from=frontend-builder /build/out /app/static
RUN mkdir -p /app/data/uploads && chmod 755 /app/data /app/data/uploads
# Build provenance for the /api/v1/version endpoint. CI passes the commit SHA
# and the head_commit timestamp so the running container can self-identify.
ARG GIT_SHA=""
ARG BUILD_TIMESTAMP=""
ENV WQ_GIT_SHA=$GIT_SHA \
    WQ_BUILD_TIMESTAMP=$BUILD_TIMESTAMP \
    WQ_STATIC_DIR=/app/static \
    WQ_UPLOADS_DIR=/app/data/uploads \
    APP_PORT=8000
VOLUME ["/app/data"]
EXPOSE 8000
# Healthcheck honours the APP_PORT override so self-hosters who run on macvlan
# can bind uvicorn to 80 (clean URLs at the container's LAN IP) without the
# healthcheck false-failing on a stale port.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS "http://localhost:${APP_PORT:-8000}/api/v1/healthz" || exit 1
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${APP_PORT:-8000} --proxy-headers"]
