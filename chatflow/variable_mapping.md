# Dify Chatflow 变量映射

## 输入变量（用户首轮消息时传入 inputs）

| Dify 变量 | 类型 | 来源 | 示例 |
|---|---|---|---|
| `order_id` | string | 用户提供 / 解析 | `ANK-2024-001` |
| `product_model` | string | 用户提供 / 视觉识别 | `Anker 737` |
| `product_category` | string | 视觉识别 / 路由表 | `power_bank` |
| `purchase_date` | string | 订单返回 | `2024-03-15` |
| `region` | string | 订单返回 / 用户提供 | `CN` |
| `channel` | string | 订单返回 | `official` |
| `user_contact` | string | 用户输入 | `user@example.com` |
| `images` | array | 用户上传 | `["https://..."]` |

## 会话变量（系统维护）

| 变量 | 类型 | 说明 |
|---|---|---|
| `intent` | enum | 当前意图分类 |
| `emotion_level` | enum | normal/upset/angry/complaint |
| `current_node_id` | string | 故障树当前节点 |
| `user_path` | array | 故障树已选路径 |
| `fault_type` | string | 故障类型 |
| `fault_description` | string | 故障描述 |
| `warranty_status` | enum | in_warranty/out_of_warranty/expiring_soon/dealer_order/unknown |
| `ambiguity_candidates` | array | 产品歧义候选 |
| `vision_evidence` | object | 视觉识别四元组 |
| `tool_retry_count` | object | 各工具重试次数 |
| `confidence` | float | 最近一次检索置信度 |
| `escalated` | boolean | 是否已升级 |

## 工具调用参数映射

### `query_order`
```json
{
  "order_id": "{{order_id}}"
}
```
返回写入：`order_info`, `product_model`, `purchase_date`, `region`, `channel`, `warranty_status`

### `check_warranty`
```json
{
  "product_model": "{{product_model}}",
  "purchase_date": "{{purchase_date}}",
  "order_id": "{{order_id}}",
  "region": "{{region}}"
}
```
返回写入：`warranty_status`, `warranty_expires`, `days_remaining`, `expiring_soon`

### `policy_retrieve`
```json
{
  "query": "{{current_query}}",
  "filters": {
    "product": "{{product_model}}",
    "region": "{{region}}"
  }
}
```
返回写入：`policy_chunks`, `policy_confidence`, `policy_answerable`

### `create_ticket`
```json
{
  "order_id": "{{order_id}}",
  "product_model": "{{product_model}}",
  "fault_type": "{{fault_type}}",
  "fault_description": "{{fault_description}}",
  "images": "{{images}}",
  "user_contact": "{{user_contact}}",
  "emotion_level": "{{emotion_level}}"
}
```
返回写入：`ticket_id`, `ticket_sla`

## 工作流主链路变量流转

```
[开始]
   ↓ (query + images)
[意图分类] → intent
   ↓
[情绪识别] → emotion_level
   ↓
[视觉识别] → vision_evidence (如有图片)
   ↓
[产品消歧] → product_model (消歧后)
   ↓
[订单查询] → order_info (若有 order_id)
   ↓
[保修检查] → warranty_status
   ↓
[路由决策] → routing_action
   ↓
[故障树执行] → current_node_id
   ↓
[政策检索] (按需) → policy_chunks, confidence
   ↓
[幻觉锁检查] → answerable
   ↓
[话术生成] → final_response
   ↓
[升级检查] → escalated
   ├─ false → [回复用户]
   └─ true → [转人工摘要] → [人工接管]
```