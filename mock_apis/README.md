# Mock API 服务 · 块2.2

## 功能
为 Chatflow 提供三个 Mock API，对接 Dify OpenAPI 自定义工具：
- `query_order` 查订单
- `check_warranty` 查保修
- `create_ticket` 创建工单

错误码齐全，模拟真实业务异常。

## 启动

```bash
cd mock_apis
pip install -r requirements.txt
python app.py
```

服务跑在 `http://0.0.0.0:8002`

## API

### 查订单 `POST /api/orders/{order_id}`

**Request body:**
```json
{
  "region": "CN",
  "channel": "official"
}
```

**Response 200:**
```json
{
  "order_id": "ANK-2024-001",
  "product_model": "Anker 737",
  "product_category": "power_bank",
  "purchase_date": "2024-03-15",
  "channel": "official",
  "region": "CN",
  "warranty_status": "in_warranty",
  "warranty_expires": "2029-09-15",
  "dealer": null
}
```

**Response 404:** `{ "error": "ORDER_NOT_FOUND", "message": "未找到此订单" }`
**Response 400:** `{ "error": "INVALID_ORDER_ID", "message": "订单号格式错误" }`

### 查保修 `POST /api/warranty/check`

**Request body:**
```json
{
  "order_id": "ANK-2024-001",
  "product_model": "Anker 737",
  "purchase_date": "2024-03-15"
}
```

**Response 200:**
```json
{
  "in_warranty": true,
  "warranty_expires": "2029-09-15",
  "days_remaining": 1095,
  "warranty_type": "standard_18m",
  "exclusions_applied": []
}
```

或 out_of_warranty 状态。

### 创建工单 `POST /api/tickets`

**Request body:**
```json
{
  "order_id": "ANK-2024-001",
  "product_model": "Anker 737",
  "fault_type": "鼓包",
  "fault_description": "充电宝底部鼓起，无法继续使用",
  "images": ["url1", "url2"],
  "user_contact": "user@example.com"
}
```

**Response 200:**
```json
{
  "ticket_id": "TKT-2026-0001",
  "status": "created",
  "estimated_resolution": "2026-09-22",
  "next_step": "客服将在 24 小时内联系您安排退换"
}
```

## 错误码规范

| 错误码 | HTTP | 含义 | 处理建议 |
|---|---|---|---|
| `ORDER_NOT_FOUND` | 404 | 订单不存在 | 询问用户是否其他渠道购买；查经销商名录 |
| `INVALID_ORDER_ID` | 400 | 订单号格式错误 | 请用户重新核对 |
| `DEALER_ORDER` | 200 | 经销商订单（非官方） | 走经销商名录匹配 |
| `OUT_OF_WARRANTY` | 200 | 过保 | 给出付费维修方案 |
| `WARRANTY_EXPIRING_SOON` | 200 | 临期（30天内到期） | 提示用户尽快申请 |
| `TICKET_CREATE_FAILED` | 500 | 工单创建失败 | 重试 2 次后转人工 |
| `INVALID_PRODUCT_MODEL` | 400 | 产品型号无效 | 触发消歧流程 |
| `PRODUCT_AMBIGUOUS` | 409 | 产品歧义（如 S1 Pro） | 追问用户澄清 |

## 集成到 Dify

`openapi_spec.json` 可直接导入 Dify 自定义工具：

1. 进入 Dify → 工作流 → 工具 → 自定义工具
2. 选择 OpenAPI / Swagger
3. 上传 `openapi_spec.json`
4. 配置鉴权（如有）
5. 工具自动出现在 Agent / 工作流节点中

## 测试订单数据

`data/orders.json` 包含 20 条 Mock 订单，覆盖：
- ✅ 在保 / 过保 / 临期
- ✅ 官方 / 京东 / 天猫 / 抖音 / 经销商
- ✅ 中国大陆 / 海外（美/欧/日）
- ✅ 充电类 / 音频类 / 智能家居
- ✅ 含 2-3 条「经销商订单查无」场景（呼应赛道官方示例）

可在 `data/orders.json` 自行扩展。