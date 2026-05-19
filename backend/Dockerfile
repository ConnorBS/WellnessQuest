ARG PYTHON_VERSION=3.12-slim
FROM python:${PYTHON_VERSION} AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev curl \
      tesseract-ocr tesseract-ocr-eng tesseract-ocr-fra tesseract-ocr-osd \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

ENV APP_PORT=8000

# --- Dev image: include dev deps, mount source via compose
FROM base AS dev
RUN pip install ".[dev]"
COPY . .
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${APP_PORT:-8000} --reload"]

# --- Prod image: copy source, no dev deps
FROM base AS prod
COPY . .
ARG GIT_SHA=""
ARG BUILD_TIMESTAMP=""
ENV WQ_GIT_SHA=$GIT_SHA \
    WQ_BUILD_TIMESTAMP=$BUILD_TIMESTAMP
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS "http://localhost:${APP_PORT:-8000}/api/v1/healthz" || exit 1
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${APP_PORT:-8000} --proxy-headers"]
