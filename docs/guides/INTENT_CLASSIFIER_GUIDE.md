# 意图分类器实现指南

## 设计原理

意图分类器是 Chatflow 第一关——分错了后面全错（排障状态机进错分支、工具调用白做、转人工延迟）。

设计原则：
1. **类别互斥**：6 类必须互斥，每条消息只对应一类
2. **置信度必须输出**：让下游决定是否要澄清
3. **不替下游做决定**：分类器只分类，不回答问题、不调工具、不决定话术
4. **会话级 intent**：多轮场景下，意图可以保持或变化

## 为什么是 6 类（不是 5 类）

| 类别 | 必要性 |
|---|---|
| 故障报修 | 售后主链路核心 |
| 咨询 | 售后次链路核心 |
| 退换 | 独立流程（要走退货政策检索） |
| 转人工 | 独立流程（要立即触发摘要） |
| **投诉/争议** | **新增**：含 315/工商/起诉 → 直接 P0，与"愤怒情绪"不同 |
| **out_of_scope** | **新增兜底**：闲聊/其他品牌/售前，避免污染主流程 |

`emotion` 在第一版是独立类，但**实际场景中情绪常叠加**（"气死了，我的充电宝鼓包"），强制二选一会丢信息。情绪作为**正交属性**走节点 05-emotion-3levels 单独处理。

## 与情绪识别的关系

```
用户: "气死了！我的充电宝鼓包了！"
            │
            ├──→ 意图分类 → troubleshooting
            └──→ 情绪识别 → angry → P1 升级
```

两条线并行：
- 意图决定走哪个流程（排障 / 退换 / 升级）
- 情绪决定紧急度（SLA、P0/P1/P2/P3）

## 多轮上下文处理

```
轮次1: "我的充电宝鼓包了"        → intent=troubleshooting
轮次2: "还在用"                  → intent=troubleshooting（继续排障）
轮次3: "好的，停用了"            → intent=troubleshooting（仍在故障分支）
轮次4: "算了，我要退货"          → intent=return_or_exchange（is_session_intent_change=true）
```

会话级 `session_intent` 是输入字段。如果当前 `intent` 与之不同，标记 `is_session_intent_change=true`，让下游知道流程要切换。

## 在 Dify 中怎么实现

### 节点类型
- **LLM 节点**：调用 M3，跑这个 prompt
- 输入变量：`current_message`, `context_messages`, `session_intent`
- 输出变量：`intent`, `confidence`, `reasoning`, `is_session_intent_change`
- **JSON 模式**：Dify LLM 节点开启"JSON 输出"，把 prompt 里的 JSON 模板作为输出格式约束

### 系统提示词拼接

节点的 system 框：

```
[00-system-prompt.txt 完整内容]
---
[01-intent-classifier.txt 完整内容]
```

### 用户消息模板

```
当前用户消息：{{current_message}}

最近对话上下文：
{{#context_messages}}
- {{role}}: {{content}}
{{/context_messages}}

会话级意图：{{session_intent | default: "none"}}
```

### 输出节点配置

Dify LLM 节点的输出 schema（如果用结构化输出）：

```json
{
  "intent": "string",
  "confidence": "number",
  "reasoning": "string",
  "is_session_intent_change": "boolean"
}
```

### 下游路由

下一个节点是**条件分支**，根据 `intent` 路由：
- `troubleshooting` → 排障状态机（节点 02）
- `inquiry` → 政策检索（节点 06）
- `return_or_exchange` → 退换流程（待设计）
- `transfer_human` → 转人工（节点 04）
- `complaint` → 紧急升级（P0）
- `out_of_scope` → 兜底回复 / 转出

## 测试方法

### 测试集（至少 20 条）

建议构造：
- 5 条简单类（每类 1 条）
- 10 条边界类（跨类易混）
- 5 条多轮类（上下文相关）

完整测试集见 [`docs/test-cases/intent-classifier.test.json`](../../test-cases/intent-classifier.test.json)。

### 评估指标

1. **准确率** = 正确数 / 总数
2. **边界准确率** = 边界用例正确数 / 边界用例数
3. **混淆矩阵**：看哪两类容易互分错

目标：
- 整体准确率 ≥ 90%
- 边界准确率 ≥ 80%
- 投诉类召回率 100%（漏掉一个 = 升级事故）

### 快速测试命令

```bash
# 在 Dify 后台 → 调试与预览 → 输入测试消息 → 看输出 JSON
# 或编程方式调用 Dify 的 chat-messages API，用同样的 prompt
```

## 调优技巧

### 1. 类别准确率不够怎么办
- 加更多 few-shot examples
- 每个类目标 ≥ 8 个例子
- 覆盖简单 / 边界 / 反例三种

### 2. 边界类混淆（比如 inquiry/troubleshooting）
- 在 prompt 里加**显式决策表**（已有"边界情况决策表"章节）
- 给反例加红字"❌ 不要这样分"

### 3. 置信度普遍偏高
- 在 prompt 里强制"不要给 1.0"
- 加"自检清单"，让 LLM 多走一步

### 4. 置信度普遍偏低
- 类比 / 决策表 / 例子少了
- 加更多正向例子

### 5. 多轮场景分错
- 检查 `session_intent` 是否传入
- 检查 `is_session_intent_change` 输出是否正确

### 6. 投诉类漏判（最严重）
- 在 prompt 顶部加**强制关键词清单**（"以下关键词出现必须归 complaint：315/工商/..."）
- 加红线："任何 315/工商/起诉词 → complaint，与其他信号冲突时优先"

### 7. out_of_scope 太多（误杀）
- 调高"含诉求"的判定标准
- 检查 "你好" 类是否真的没诉求

## 当前版本的边界（已知）

1. **复合诉求**："我的充电宝鼓包了，我要退货"
   - 当前会归 `return_or_exchange`（按"强诉求"原则）
   - 可改进：识别为 `compound`，单独走"先确认故障再退换"流程
2. **方言/口语**："鼓包咯咋整"
   - 当前未覆盖
   - 需补方言语料到 few-shot
3. **表情符号**："😅😅"
   - 当前未覆盖
   - 需在 prompt 里说明

## 下一步优化方向

1. **混合分类器**：先关键词匹配（rule-based），再用 LLM 兜底
   - 节省 token，提升速度
   - 提升已知模式准确率
2. **少量学习**：构造 50-100 条标注样本，few-shot 微调小模型
3. **用户分层**：VIP 客户 / 普通客户 不同优先级
4. **会话级状态机**：intent 变化要触发"提示用户"，让用户知道流程在切换

需要我做以下任何一项吗？
- 📋 写完整 20 条测试用例 JSON
- 🛠 设计 Dify Chatflow DSL（导出文件可直接导入）
- 🔍 写混合分类器（关键词规则 + LLM 兜底）
- 📊 写评估脚本（自动跑测试集，计算准确率）