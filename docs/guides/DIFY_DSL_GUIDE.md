# Dify Chatflow DSL 导入与使用指南

## 文件位置

[`chatflow/anker-aftersales-chatflow.yml`](../../chatflow/anker-aftersales-chatflow.yml)

## 当前 DSL 结构

```
节点数: 12 个
边数: 16 条
模式: advanced-chat (Chatflow)
版本: 0.6.0
模型: MiniMax-M3（langgenius/MiniMax/MiniMax/MiniMax）

流程:
start → emotion → intent → router (question-classifier)
                                ├─ topic_troubleshooting  → troubleshoot_handler ┐
                                ├─ topic_inquiry          → inquiry_handler     │
                                ├─ topic_return           → return_handler      │
                                ├─ topic_transfer         → transfer_handler    ├→ final_answer
                                ├─ topic_complaint         → complaint_handler   │
                                └─ topic_oos              → oos_handler         ┘
                                                                    ↓
                                                              aggregator
```

## 导入步骤

### 1. 打开 Dify 后台
访问 `https://dify.high33light.cn/`，登录。

### 2. 导入 DSL
```
Studio → 工作室 → 创建应用 → 选 "Chatflow (advanced-chat)"
→ 跳过初始模板 → 点 "导入 DSL" 按钮（一般在右上角菜单）
→ 上传 chatflow/anker-aftersales-chatflow.yml
```

### 3. 验证导入
进入 Chatflow 编辑器，应该看到：
- 12 个节点，左到右布局
- 1 条主线（start → emotion → intent → router）
- 6 条分支从 router 向右展开
- 6 条分支汇聚到 aggregator
- aggregator → final_answer

### 4. 配置模型
每个 LLM 节点的 `provider` 和 `name` 字段已经填好：
```yaml
provider: "langgenius/MiniMax/MiniMax/MiniMax"
name: "MiniMax-M3"
```

如果你们有更标准的 provider 路径（如 `langgenius/MiniMax`），需要在 Dify 后台逐个改。

### 5. 测试对话
点 "调试与预览"，输入测试消息：
- "我的 737 不工作了" → 应该走到 troubleshoot_handler
- "保修多久" → 应该走到 inquiry_handler
- "我要投诉到 315" → 应该走到 complaint_handler

### 6. 发布
点 "发布" 按钮 → 选 "发布更新" → 获取 API key。

## 已知限制

### ❌ 工具调用未集成
当前 DSL 没有集成工具节点（query_order / check_warranty / policy_retrieve / create_ticket）。原因：
- Dify Chatflow 中 LLM 节点不能直接调外部 API
- 需要 tool 节点或 agent 节点 + 工具供应商配置

**集成方案**（后续优化）：
1. 在 Dify 后台 → 工作室 → 工具 → 自定义工具
2. 上传 `mock_apis/openapi_spec.json`
3. 在 troubleshoot_handler 前加 tool 节点链
4. 或切换到 agent 节点，自动调工具

### ❌ 视觉跳级未集成
当前没有处理图片上传后的视觉识别（4.6 视觉跳级）。原因：
- Dify 视觉能力是单独的 vision-enabled 模型
- 需要在 troubleshoot_handler 前加 vision LLM 节点

**集成方案**：
- emotion_node 旁加 vision_node（用 vision 模式）
- 输出四元组 JSON → 注入到 troubleshoot_handler 的 prompt

### ❌ 排障状态机未完整实现
当前 troubleshoot_handler 是一个普通 LLM 节点，没接故障树 JSON。要完整实现需要：
- 故障树作为 conversation_variable 注入
- LLM 节点从变量读取故障树
- 状态机推进逻辑

## 当前 DSL 跑通后的样子

跑通后用户能看到：
```
用户: "我的 737 充不进电"
AI: "请问充电宝目前是停止使用状态吗？"  ← troubleshoot_handler 输出
```

```
用户: "保修多久？"
AI: "Anker 大部分产品保修期是 12-18 个月，以您订单详情为准。请问您的订单号？"  ← inquiry_handler
```

```
用户: "我要投诉到 315"
AI: "您反映的情况我们已经收到并立即升级处理。1 小时内会有专员主动致电您..."  ← complaint_handler
```

```
用户: "你们公司在哪？"
AI: "您好，我主要帮您处理 Anker、Soundcore、eufy 品牌的产品售后问题。请问您的产品遇到什么情况？"  ← oos_handler
```

## 调优点

### 1. 每个分支的 prompt 可以更精细
当前 6 个 handler 的 system prompt 是简化版。要做完整版：
- troubleshoot_handler → 拼入 `02-troubleshooting-state.txt`
- inquiry_handler → 拼入 `06-hallucination-locks.txt`（检索约束）
- 等等

**操作**：在 Dify 后台打开每个 LLM 节点，把 `chatflow/prompts/0X-*.txt` 的内容贴到 system 框。

### 2. 加 system prompt 基座
每个 LLM 节点的 system 应该是：
```
[00-system-prompt.txt]
---
[当前节点对应的 prompt]
```

### 3. 加工具节点
具体步骤（详见 `docs/guides/TOOLS_SETUP.md`）：
1. mock_apis/openapi_spec.json 上传到 Dify 自定义工具
2. troubleshoot_handler 前加 4 个 tool 节点
3. 用 code 节点做工具调用编排

### 4. 加视觉能力
1. troubleshoot_handler 改成 agent 节点
2. 启用 vision
3. 加 image-aware prompt

### 5. 加变量回写
emotion_node 和 intent_node 输出的 emotion_level 和 intent，应该写入 conversation_variable。当前模型只在节点间传递，没持久化。

## 测试 checklist

导入并跑通后，验证：

| 测试 | 期望 |
|---|---|
| "我的 737 不工作了" | troubleshoot_handler |
| "鼓包了怎么办" | inquiry_handler（边界） |
| "气死！鼓包了！" | troubleshoot_handler（情绪不影响） |
| "我要退货" | return_handler |
| "转人工" | transfer_handler |
| "315 见" | complaint_handler |
| "你好" | oos_handler |
| "你们公司在哪" | oos_handler |
| 输入图片 + "看看这个" | （需 vision 集成） |

## 故障排查

### 导入报错 "Invalid DSL"
- 检查 YAML 格式（缩进、特殊字符）
- 检查 provider 路径是否正确

### 节点无法连线
- 检查 question-classifier 的 topics 是否有对应边
- 检查 sourceHandle 是否匹配 topic ID

### 调试时分支走错
- 检查 router_node 的 instructions
- 检查每个分支的 prompt 是否混淆

### 答案不显示
- 检查 final_answer 节点的 answer 模板
- 检查 aggregator 的变量选择器

## 下一步

1. **导入试运行**：先按当前 DSL 导入跑通基本对话
2. **调优 prompt**：把每个节点的 prompt 替换为 `chatflow/prompts/` 下完整版本
3. **加 system 基座**：每个 LLM 节点 system 框拼上 `00-system-prompt.txt`
4. **集成工具**：上传 OpenAPI spec，加 tool 节点
5. **集成视觉**：加 vision 模式
6. **接入前端**：用前端的 `VITE_DIFY_API_URL` + `VITE_DIFY_API_KEY` 连接

## 文件清单

| 文件 | 说明 |
|---|---|
| `chatflow/anker-aftersales-chatflow.yml` | 主 DSL 文件，可导入 |
| `chatflow/prompts/00-system-prompt.txt` | 通用系统提示词 |
| `chatflow/prompts/01-07-*.txt` | 各节点 prompt |
| `chatflow/variable_mapping.md` | 变量映射参考 |
| `docs/guides/SYSTEM_PROMPT_GUIDE.md` | system prompt 使用指南 |
| `docs/guides/INTENT_CLASSIFIER_GUIDE.md` | 意图分类指南 |
| `mock_apis/openapi_spec.json` | 工具集成用 |

需要我做以下任何一项吗？
- 📥 **导出 DSL 导入脚本**：自动登录 Dify 上传 DSL
- 🔧 **加工具节点**：在 DSL 中集成 tool 节点
- 👁 **加视觉节点**：让 troubleshoot 支持图片
- 📋 **写 20 条测试用例 JSON**：自动跑通测试