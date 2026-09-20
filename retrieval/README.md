# 检索服务 · 块2.1

## 功能
- 按条款边界切片政策文档
- 元数据：产品 / 区域 / 渠道
- 混合检索：BM25（关键词）+ 向量（语义）
- 重排 + 置信度返回
- 低置信度返回「无可靠结果」

## 启动

```bash
cd retrieval
pip install -r requirements.txt
cp .env.example .env  # 填入 M3 API key、向量库路径等
python app.py
```

服务跑在 `http://0.0.0.0:8001`

## API

### `POST /retrieve`

**Request:**
```json
{
  "query": "我的充电宝鼓包了还能用吗",
  "top_k": 5,
  "filters": {
    "product": "Anker 737",
    "region": "CN",
    "channel": "official"
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "chunk_id": "policy-737-cn-001",
      "text": "充电宝出现鼓包、漏液、异味等异常时，应立即停止使用...",
      "metadata": {"product": "Anker 737", "region": "CN", "article": "第3条"},
      "score": 0.87,
      "sources": ["bm25", "vector"]
    }
  ],
  "confidence": 0.82,
  "answerable": true,
  "low_confidence_reason": null
}
```

低置信度时：
```json
{
  "results": [],
  "confidence": 0.31,
  "answerable": false,
  "low_confidence_reason": "no_relevant_match",
  "fallback_message": "抱歉，未找到可靠的政策条款，建议转人工核实。"
}
```

### `GET /healthz`

健康检查。

### `POST /index`

（一次性）索引文档到向量库 + BM25。

## 切片策略

### 政策文档（条款边界）
- 按 `第N条` / `Article N` / `## N.` 切分
- 每条保留标题 + 正文
- 元数据自动提取：产品名、区域、渠道

### 说明书（章节边界）
- 按 `##` / `###` 切分
- 保留章节标题
- 长度限制：200–800 字 / chunk

### FAQ（问答对）
- 每条 FAQ 作为一个 chunk
- 元数据：category、product

## 置信度算法

```
combined_score = 0.5 * bm25_score_normalized + 0.5 * vector_score_normalized
answerable = (combined_score > THRESHOLD) AND (top1_score > TOP1_MIN)
```

默认：
- `THRESHOLD = 0.5`
- `TOP1_MIN = 0.4`
- 配置在 `config.py` 可调

## 测试

```bash
cd retrieval
pytest tests/
```

测试覆盖：
- 条款切片正确性
- BM25 检索召回
- 向量检索召回
- 混合检索融合
- 置信度阈值边界
- 20 真实问法命中率（≥80%）

## 集成到 Dify

Dify Chatflow 工具配置：
- 工具名：`policy_retrieve`
- Method: POST
- URL: `https://<your-domain>/retrieve`
- Body: 见上方 Request 格式
- 在 Chatflow 中按需调用，结果进入 4.2 出处锁节点