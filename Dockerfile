# AXIS backend — works for local Docker Compose (port 8000) and HF Spaces (port 7860).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.cache/hf \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/st \
    PORT=8000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# /data is the mount point for the persistent volume (axis_db + docs).
# Falls back to /app/axis_db when running standalone (HF Spaces, CI).
RUN mkdir -p /data/axis_db /data/docs

EXPOSE ${PORT}
CMD ["sh", "-c", "uvicorn api:app --host 0.0.0.0 --port ${PORT}"]
