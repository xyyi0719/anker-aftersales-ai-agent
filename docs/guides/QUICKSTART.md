# 快速启动指南

> 5 分钟把本地环境跑起来

## 前置条件

- Python 3.10+
- 已部署的 Dify（块0）
- M3 API Key（已有）

## 1. 启动 Mock API

```bash
cd mock_apis
pip install -r requirements.txt
python app.py
```

✅ 看到 `Uvicorn running on http://0.0.0.0:8002`
- Swagger UI: http://localhost:8002/docs
- 健康检查: http://localhost:8002/healthz

## 2. 启动检索服务

```bash
cd retrieval
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入 M3_API_KEY
python app.py
```

✅ 看到 `Uvicorn running on http://0.0.0.0:8001`
- Swagger UI: http://localhost:8001/docs
- 健康检查: http://localhost:8001/healthz

## 3. 入库示例数据（可选）

```bash
cd retrieval
python scripts/ingest.py \
  --source ../../knowledge_base \
  --retrieval-url http://localhost:8001
```

或手动测试：
```bash
curl -X POST http://localhost:8001/index \
  -H "Content-Type: application/json" \
  -d @data/policies.example.json
```

## 4. 测试检索

```bash
curl -X POST http://localhost:8001/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "query": "充电宝鼓包怎么办",
    "top_k": 3
  }'
```

预期响应：
```json
{
  "results": [{"chunk_id": "...", "text": "...", "score": 0.87}],
  "confidence": 0.82,
  "answerable": true
}
```

## 5. 测试 Mock API

```bash
# 查订单
curl -X POST http://localhost:8002/api/orders/ANK-2024-001

# 查保修
curl -X POST http://localhost:8002/api/warranty/check \
  -H "Content-Type: application/json" \
  -d '{
    "product_model": "Anker 737",
    "purchase_date": "2024-03-15"
  }'

# 创建工单
curl -X POST http://localhost:8002/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "product_model": "Anker 737",
    "fault_type": "鼓包",
    "fault_description": "充电宝底部鼓起，无法继续使用",
    "user_contact": "test@example.com",
    "emotion_level": "angry"
  }'
```

## 6. 在 Dify 中配置工具

1. 打开 Dify → 工作流 → 自定义工具
2. 上传 `mock_apis/openapi_spec.json`
3. 配置三个工具：`query_order` / `check_warranty` / `create_ticket`
4. （可选）配置 `policy_retrieve` 工具指向检索服务

## 7. 在 Dify 中搭建 Chatflow

按 `docs/01-architecture.md` 的流程图搭建。
每个 LLM 节点的 prompt 在 `chatflow/prompts/` 目录下。

## 故障排查

| 现象 | 排查 |
|---|---|
| 检索服务 500 | 检查 `.env` 里 `M3_API_KEY` 是否正确 |
| 向量维度不匹配 | 调整 `embedder.py` 里 `self.dim` |
| BM25 中文乱码 | 确认 `jieba` 已正确安装 |
| Mock API 404 | 检查订单号是否在 `data/orders.json` 里 |
| Dify 工具调用失败 | 检查服务是否公网化（不能 localhost） |

## 公网化（决赛前必做）

三个方案选一：

### 方案 A：Cloudflare Tunnel（推荐，免费）
```bash
# 安装 cloudflared
# 启动隧道
cloudflared tunnel --url http://localhost:8001
cloudflared tunnel --url http://localhost:8002
```
会得到 `https://xxx.trycloudflare.com` 临时域名。

### 方案 B：ngrok
```bash
ngrok http 8001
ngrok http 8002
```

### 方案 C：阿里云轻量服务器
部署到云上，配置 nginx + HTTPS。

决赛前必须稳定公网化！