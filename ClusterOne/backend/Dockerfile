# ClusterOne Core Cluster Engine (FastAPI). Build context: ./backend
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# State (SQLite database + dev-mode job logs) lives on a volume, never in the image.
RUN useradd --system --uid 10001 clusterone && mkdir /data && chown clusterone /data
USER clusterone
ENV CLUSTERONE_DATABASE_URL=sqlite:////data/clusterone.db \
    CLUSTERONE_LOG_DIR=/data/job-logs
VOLUME /data

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=4s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
