#!/usr/bin/env python3
"""
一键修复 dify/docker/docker-compose.yaml：
1. 在 services 段（certbot 后）插入 retrieval + mock-apis 两个服务
2. 在 volumes: 段添加 retrieval_data named volume
3. 不动其他内容

用法: python3 fix_compose.py
要求: 必须在 ~/dify/docker 目录下运行
"""
import sys
from pathlib import Path

COMPOSE = Path("docker-compose.yaml")

SERVICES_YAML = """  retrieval:
    build:
      context: ..
      dockerfile: docker/services/Dockerfile
    container_name: anker-retrieval
    restart: always
    environment:
      - PYTHONUNBUFFERED=1
      - M3_API_BASE=https://api.MiniMax.com/v1
      - M3_API_KEY=${M3_API_KEY:-}
    volumes:
      - retrieval_data:/app/retrieval/data
    command: ["uvicorn", "retrieval.app:app", "--host", "0.0.0.0", "--port", "8001", "--app-dir", "/app/retrieval"]
    networks:
      - ssrf_proxy_network
      - default
    healthcheck:
      test: ["CMD", "python", "/app/healthcheck.py", "8001"]
      interval: 30s
      timeout: 5s
      retries: 3

  mock-apis:
    build:
      context: ..
      dockerfile: docker/services/Dockerfile
    container_name: anker-mock-apis
    restart: always
    depends_on:
      retrieval:
        condition: service_healthy
    environment:
      - PYTHONUNBUFFERED=1
      - RETRIEVAL_URL=http://retrieval:8001
    command: ["uvicorn", "mock_apis.app:app", "--host", "0.0.0.0", "--port", "8002", "--app-dir", "/app/mock_apis"]
    networks:
      - ssrf_proxy_network
      - default
    healthcheck:
      test: ["CMD", "python", "/app/healthcheck.py", "8002"]
      interval: 30s
      timeout: 5s
      retries: 3
"""

VOLUME_LINE = "  retrieval_data:\n"


def main():
    if not COMPOSE.exists():
        print(f"ERROR: {COMPOSE} not found. Run from ~/dify/docker/", file=sys.stderr)
        sys.exit(1)

    text = COMPOSE.read_text()

    # 检查是否已经添加过（防止重复运行）
    if "anker-retrieval" in text or "anker-mock-apis" in text:
        print("WARN: services already present. Skipping insertion.")
    else:
        # 在 certbot block 之后、volumes: 段之前插入
        # 找 `command: ["tail", "-f", "/dev/null"]` 后的位置（certbot 的最后一行）
        marker = 'command: ["tail", "-f", "/dev/null"]'
        idx = text.find(marker)
        if idx == -1:
            print(f"ERROR: certbot marker not found", file=sys.stderr)
            sys.exit(1)
        # 找到 marker 行末
        line_end = text.find("\n", idx)
        insert_at = line_end + 1
        text = text[:insert_at] + "\n" + SERVICES_YAML + text[insert_at:]
        print("OK: inserted 2 services after certbot block")

    # 添加 retrieval_data named volume
    if "retrieval_data:" in text:
        print("WARN: retrieval_data already present. Skipping.")
    else:
        # 在 ^volumes: 行末尾加一行
        lines = text.split("\n")
        out = []
        inserted = False
        for ln in lines:
            out.append(ln)
            # 只匹配顶层 volumes: （无前置空格），服务内部的 volumes: 有缩进
            if not inserted and ln == "volumes:":
                out.append(VOLUME_LINE.rstrip())
                inserted = True
        text = "\n".join(out)
        if inserted:
            print("OK: added retrieval_data named volume")
        else:
            print("ERROR: top-level volumes: block not found", file=sys.stderr)
            sys.exit(1)

    COMPOSE.write_text(text)
    print("DONE: docker-compose.yaml updated")

    # 验证
    text = COMPOSE.read_text()
    if "anker-retrieval" in text and "anker-mock-apis" in text and "retrieval_data:" in text:
        print("VERIFY: all 3 changes confirmed in file")
    else:
        print("VERIFY: FAILED - something missing", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()