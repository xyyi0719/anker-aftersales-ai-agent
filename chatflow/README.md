# Chatflow 配置 · 块3 + 块4

本目录存放 Dify Chatflow 所需的 prompt 模板、变量映射、工具调用参数。

## 目录结构

```
chatflow/
├── prompts/                  # 各节点 prompt 草稿
│   ├── 00-system-prompt.txt         # ⭐ 通用系统提示词（所有 LLM 节点都拼上）
│   ├── 01-intent-classifier.txt    # 块3.1 意图分类
│   ├── 02-troubleshooting-state.txt # 块3.2 排障状态机
│   ├── 03-tool-call-loop.txt        # 块3.3 工具调用
│   ├── 04-escalation-human.txt      # 块3.4 转人工
│   ├── 05-emotion-3levels.txt       # 块4.5 情绪三级
│   ├── 06-hallucination-locks.txt   # 块4.1-4.4 幻觉四防线
│   └── 07-vision-skip.txt           # 块4.6 视觉跳级
└── templates/                # 故障树 / 路由表 占位模板
    ├── fault_tree.example.json
    └── routing_policy.example.json
```

> ⭐ **00 是基础**。每个 LLM 节点的 system 框都应该是：`00 + 对应节点 prompt`。
> 详见 [`docs/guides/SYSTEM_PROMPT_GUIDE.md`](../docs/guides/SYSTEM_PROMPT_GUIDE.md)。

## 接入 Dify

### 方式 1：手动配置（推荐）
1. 进入 Dify → 工作流 → 创建 Chatflow
2. 按 `docs/01-architecture.md` 的流程图拖节点
3. 每个 LLM 节点粘贴对应 prompt（去掉 markdown 包裹）
4. 工具节点导入 `mock_apis/openapi_spec.json`
5. 变量映射见 `variable_mapping.md`

### 方式 2：导入 DSL（高级）
Dify 支持导出/导入 Chatflow DSL，可将整个流程一键导入。
本目录暂未提供完整 DSL（等 Chatflow 调通后再导出）。

## 变量约定

Dify Chatflow 中统一使用以下会话变量（在 inputs 中传入）：

| 变量 | 类型 | 说明 |
|---|---|---|
| `order_id` | string | 订单号 |
| `product_model` | string | 产品型号 |
| `purchase_date` | string | 购买日期 |
| `region` | string | 区域 |
| `channel` | string | 渠道 |
| `emotion_level` | enum | 情绪等级：normal/upset/angry/complaint |
| `fault_type` | string | 故障类型 |
| `fault_description` | string | 故障描述 |
| `images` | array | 图片 URL |
| `user_contact` | string | 用户联系方式 |

每次工具调用后，结果写入变量供后续节点使用。

## 关键设计原则

1. **状态机驱动**：LLM 只做话术润色和回答归一化，业务逻辑由变量和节点控制
2. **置信度优先**：低置信度不强行回答
3. **诚实升级**：识别情绪 → 主动升级
4. **出处可追溯**：每条政策类回答带条款出处