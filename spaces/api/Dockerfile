# FastAPI Docker Space — build context is this folder (spaces/api)
FROM python:3.12-slim

RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    DATA_DIR=/data/processed \
    HF_DATA_REPO=dtquocbao/SpatialVision-data \
    CORS_ORIGINS=*

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements-sv07.txt /app/requirements-sv07.txt
RUN pip install --no-cache-dir -r /app/requirements-sv07.txt

COPY ensure_data.py /app/ensure_data.py
COPY SV07_backend_main.py /app/SV07_backend_main.py

RUN mkdir -p /data/processed && chown -R user:user /app /data
USER user

EXPOSE 7860
CMD ["uvicorn", "SV07_backend_main:app", "--host", "0.0.0.0", "--port", "7860"]
