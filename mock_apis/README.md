# 售后模拟接口

从仓库根目录运行 `uvicorn mock_apis.app:app --port 8002`。订单和政策为模拟配置，不构成真实权益。

- GET/POST `/api/orders/{order_id}`：模拟订单，找不到时 `found=false`。
- POST `/api/warranty/check`：只需 `order_id`；从服务端订单计算，不采纳调用者传入的日期/型号。未知规则返回 `in_warranty=null`。
- POST `/api/policy/retrieve`：query/top_k/filters/order_id；政策必须关联已知订单，FAQ 使用离线检索。
- POST `/api/tickets`：conversation_id/summary；SQLite 幂等模拟交接，dispatched=false。
- POST `/api/chat/turn`：query/conversation_id/state/extraction/has_image；Dify 受限规则入口。
- GET `/healthz`、`/health`：健康检查。
- GET `/openapi.json`：当前可导入的 OpenAPI 契约；仓库 `openapi_spec.json` 由当前 app 重新生成。

设置 `RETRIEVAL_URL` 时调用独立检索服务，失败返回不可作答；未设置时调用相同的本地检索实现。`TICKET_DB` 控制工单数据库路径；`MOCK_API_KEY` 若启用则请求需携带 X-API-Key。正式 Compose 不向公网映射 API 端口。
