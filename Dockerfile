# SpatialVision — Hugging Face Docker Space
# https://huggingface.co/docs/hub/spaces-sdks-docker

FROM python:3.12-slim

# HF Spaces run as uid 1000
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    DATA_DIR=/data/processed \
    FRONTEND_DIR=/app/app/frontend/dist

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps (API-only subset; full scientific stack is in requirements-sv07.txt)
COPY app/requirements-sv07.txt /app/app/requirements-sv07.txt
RUN pip install --no-cache-dir -r /app/app/requirements-sv07.txt

# Frontend build (same-origin API → empty VITE_API_URL)
COPY app/frontend/package.json app/frontend/package-lock.json /app/app/frontend/
WORKDIR /app/app/frontend
RUN npm ci
COPY app/frontend/ /app/app/frontend/
RUN VITE_API_URL= npm run build

# Backend
WORKDIR /app
COPY app/SV07_backend_main.py /app/app/SV07_backend_main.py
RUN printf '' > /app/app/__init__.py

# Optional processed data baked in at build time (prefer Space persistent storage / manual upload)
RUN mkdir -p /data/processed && chown -R user:user /app /data
USER user

EXPOSE 7860
WORKDIR /app/app
CMD ["uvicorn", "SV07_backend_main:app", "--host", "0.0.0.0", "--port", "7860"]
