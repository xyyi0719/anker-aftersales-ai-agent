#!/usr/bin/env python3
"""
通用健康检查脚本 — 接收端口参数，访问 /healthz 端点。
被 docker-compose healthcheck 使用，避免 CMD-SHELL 嵌套引号问题。
"""
import sys
import urllib.request
import urllib.error

def check(port: int) -> int:
    url = f"http://localhost:{port}/healthz"
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            if resp.status == 200:
                return 0
            print(f"health check failed: {url} returned {resp.status}", file=sys.stderr)
            return 1
    except (urllib.error.URLError, urllib.error.HTTPError, ConnectionError, OSError) as e:
        print(f"health check error: {url} - {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: healthcheck.py <port>", file=sys.stderr)
        sys.exit(2)
    sys.exit(check(int(sys.argv[1])))