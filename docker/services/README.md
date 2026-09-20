# Anker Mock APIs + Retrieval 容器化部署

## 文件
- `Dockerfile` — 构建 Python 3.11 slim 镜像，含 fastapi/faiss/jieba
- `docker-compose.addon.yml` — 在 Dify 同网络里跑两个服务
- `requirements.txt` — 依赖

## 部署步骤

### 1. 把这两个目录拷到 dify 服务器
```bash
# 在本地打包
cd D:/playground/pi/anker
tar czf services.tar.gz mock_apis retrieval docker

# 上传到服务器（假设 dify 在 /root/dify 目录）
scp services.tar.gz root@your-server:/root/dify/

# 服务器上解压
cd /root/dify
tar xzf services.tar.gz
```

### 2. 把 docker-compose.addon.yml 合进 dify/docker-compose.yml
或者直接 `docker compose -f docker-compose.yml -f docker-compose.addon.yml up -d`

### 3. 启动
```bash
docker compose up -d mock-apis retrieval
docker compose logs -f mock-apis
# 看到 "Uvicorn running on http://0.0.0.0:8002" 即成功
```

### 4. 验证
```bash
# 在服务器上
docker compose exec mock-apis curl -s http://localhost:8002/healthz
# → {"status":"ok"}
docker compose exec retrieval curl -s http://localhost:8001/healthz
# → {"status":"ok","chunks_loaded":N,"index_ready":true}
```

### 5. Dify 工具配置 server URL
```json
"servers": [{"url": "http://mock-apis:8002"}]
```
Dify 容器内部 DNS 自动解析 `mock-apis` 到同一网络的容器 IP。

### 6. 检索服务需要 seed 数据
```bash
docker compose exec retrieval python -m retrieval.scripts.seed_demo
```