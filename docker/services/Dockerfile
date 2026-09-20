FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY docker/services/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY mock_apis/ /app/mock_apis/
COPY retrieval/ /app/retrieval/
COPY knowledge_base/ /app/knowledge_base/
COPY docker/services/healthcheck.py /app/healthcheck.py
EXPOSE 8001 8002
CMD ["uvicorn", "mock_apis.app:app", "--host", "0.0.0.0", "--port", "8002"]
