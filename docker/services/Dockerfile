FROM python:3.11-slim

WORKDIR /app

# 健康检查用 curl（python 镜像可能没装，先用 python 自带 urllib 替代）
COPY docker/services/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy both services into one image; CMD chooses which to run.
COPY mock_apis/  /app/mock_apis/
COPY retrieval/  /app/retrieval/

# 健康检查脚本（不需要容引号）
COPY docker/services/healthcheck.py /app/healthcheck.py
RUN chmod +x /app/healthcheck.py

# Default: mock_apis on 8002. Override CMD to ["retrieval-app"] for retrieval.
EXPOSE 8001 8002

CMD ["sh", "-c", "uvicorn mock_apis.app:app --host 0.0.0.0 --port 8002 --app-dir /app"]