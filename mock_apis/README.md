# 售后模拟接口

从仓库根目录运行 `uvicorn mock_apis.app:app --port 8002`。订单和政策为模拟配置，不构成真实权益。

- GET/POST `/api/orders/{order_id}`：模拟订单，找不到时 `found=false`。
- POST `/api/warranty/check`：只需 `order_id`；从服务端订单计算，不采纳调用者传入的日期/型号。未知规则返回 `in_warranty=null`。
- POST `/api/policy/retrieve`：query/top_k/filters/order_id；政策必须关联已知订单，FAQ 使用离线检索。
- POST `/api/tickets`：conversation_id/summary；SQLite 幂等模拟交接，dispatched=false。
- POST `/api/chat/action`：conversation_id/action/ticket_id；只接受白名单动作 `transfer_to_agent`。
  工单 ID 由会话哈希派生，因此它同时是归属凭证——会话对不上即 403，不泄露工单是否存在。
  重复调用幂等；`dispatched` 恒为 `false`（未对接真实客服队列）。
- POST `/api/chat/turn`：query/conversation_id/state/extraction/has_image；Dify 受限规则入口。
- GET `/healthz`、`/health`：健康检查。
- GET `/openapi.json`：当前可导入的 OpenAPI 契约；仓库 `openapi_spec.json` 由当前 app 重新生成。

## 数据说明

- `data/orders.json`：23 笔模拟订单，每笔带 `user_id`。其中 `DEMO-US/AMZ/CN` 三笔用于演示。
- `data/users.json`：10 份模拟用户档案。`orders_count` 由订单实时统计；
  **`tickets_count` / `complaints_count` 是模拟的历史字段，不对应工单库里的真实记录**，
  仅用于演示档案展示，不要当作可核验的历史数据引用。
- `data/tickets.sqlite3`：运行期生成，不入库。旧库为 `(id, summary)` 两列，
  首次打开会自动补 `status` 列（见 `routes/tickets.py` 的 `_connect`）。

设置 `RETRIEVAL_URL` 时调用独立检索服务，失败返回不可作答；未设置时调用相同的本地检索实现。`TICKET_DB` 控制工单数据库路径；`MOCK_API_KEY` 若启用则请求需携带 X-API-Key。正式 Compose 不向公网映射 API 端口。
