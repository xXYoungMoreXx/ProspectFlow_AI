FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# 1. Install production dependencies only
FROM base AS deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e "." 2>/dev/null || pip install --no-cache-dir .

# 2. Production image
FROM deps AS runner

# Non-root user
RUN groupadd --gid 1001 runtime && \
    useradd --uid 1001 --gid runtime --no-create-home runtime

COPY --chown=runtime:runtime src ./src

USER runtime

ENV RUNTIME_HOST=0.0.0.0
ENV RUNTIME_PORT=8080
EXPOSE 8080

CMD ["python", "-m", "src.main"]
