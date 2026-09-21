# 三层接口契约（唯一真源）

> 前端渲染 ←→ Dify 提取 ←→ Mock 消费 是**同一个契约的三个端点**。改任何一端必须同步另两端。
> 本文是这把尺子：**三端代码里出现的每个字段，都必须能在这里找到定义；本文没有的字段，代码里也不许有。**

版本 v1 · 2026-09-21 · 状态：**待实现**（本文描述目标契约，下方"现状"列标注与目标的差距）

---

## 0. 一次对话的数据流

```
用户文字+图片
  → Dify start 节点 (sys.query / sys.files)
  → Dify LLM「意图与图片理解」  产出 extraction JSON   ← 契约 A
  → Dify code 节点 pack       包成 HTTP body
  → Mock POST /api/chat/turn                        ← 契约 A（消费）
  → Mock 产出 answer + state                        ← 契约 B（产出）
  → Dify code 节点 unpack      answer 末尾追加 __EVIDENCE_V1__<base64(state)>
  → 前端 parseEvidence 解出 state                    ← 契约 B（消费）
  → 前端据此渲染审计看板                              ← 契约 C
```

**契约 A** = LLM 输出 → Mock 输入
**契约 B** = Mock 输出 → 前端输入
**契约 C** = 前端渲染依赖的内部字段

---

## 契约 A：extraction（Dify LLM 节点产出，传给 Mock）

Mock 入口 `mock_apis/engine.py:chat()` 读取 `data['extraction']`。

| 字段 | 取值域 | 消费点 | 现状差距 |
|---|---|---|---|
| `vision.product_model` | `Anker737` \| `Soundcore` \| `unknown` | engine 目前**只用于比较**（:135/:136），**不用于设定 product** | ⚠️ 需改为参与赋值 |
| `vision.fault_location` | 中文自由文本，未知填 `unknown` | 前端展示（`VisionInspector`） | ✅ |
| `vision.fault_phenomenon` | **见下方枚举** | engine 安全判定与跳级；前端中文匹配 | ❌ 现为 `phenomenon` + 英文 5 值枚举，三端不一致 |
| `vision.confidence` | `0.0`–`1.0` | engine 阈值 **0.8**；前端阈值 **0.75** | ❌ 两处阈值不一致 |
| `vision.is_anker_product` | `true` \| `false` | engine 拒答判定（:135）；前端拒答横幅（`VisionInspector:117`） | ❌ **YAML 完全不输出**，engine 判断恒为 False，前端硬编码 true |
| `vision.brand` | 中文/英文品牌名，未知填 `unknown` | 仅前端展示（给评审看视觉依据） | ❌ 缺失 |
| `intents` | `troubleshooting` \| `inquiry` \| `return_or_exchange` \| `transfer_human` \| `complaint` \| `out_of_scope` 的**数组** | `engine.py:126` | ✅ |
| `branch_answer` | 排障树中已有选项的中文原文，无明确答案时**空字符串** | `engine.py:142` | ✅ |

### 契约 A 的现象枚举（`fault_phenomenon`）

统一使用中文，与 `chatflow/prompts/07-vision-skip.txt`、`VisionInspector.tsx` 的判定词一致。

| 分组 | 取值 | 引擎行为 |
|---|---|---|
| 安全类 | `鼓包` `冒烟` `起火` `漏液` `焦黑` `异味` | **立即停用 + 升级人工**（不看品牌、不看置信度） |
| 硬件类 | `接口损坏` `内部暴露` | 跳级到质保核验 |
| 硬件类 | `线材破损` | 建议更换线材，**低危不升级** |
| 硬件类 | `外壳破损` | 疑似人为损坏，核实保修范围 |
| 硬件类 | `屏幕异常` | 跳级到屏幕相关分支 |
| 无异常 | `正常` | 不跳级 |
| 无法判断 | `unknown` | 不跳级，追问补充 |

> 现状差距：YAML 只输出 `screen_dark|swelling|smoke|burn|unknown`，无法表达"接口损坏/线材破损/外壳破损/内部暴露"，因此 06–10 号图**注定无法跳级**。

### 契约 A 的硬规则

1. **图片不能确立型号归属时，允许从图片设定 `product`**——这是修复 01/02/06/07/08/10 的关键。
2. **安全类现象优先于一切**：命中即停用+升级，不要求 `confidence >= 0.8`。
3. **`is_anker_product === false` 时不得进入排障流程**，直接走边界拒答。
4. 图片结论与用户文字冲突时，**不跳级**，追问确认。

---

## 契约 B：Mock 产出（写进 `__EVIDENCE_V1__` 的内容）

`mock_apis/engine.py` 返回 `{answer, state, ...}`；Dify `unpack` 节点把 `state` 做 base64 追加到 answer 尾部。

标记格式：`__EVIDENCE_V1__<base64(json(state))>__EVIDENCE_END__`
前端 `utils/evidence.ts` 校验：`schema_version === 1 && mock === true`，否则**整段丢弃**。

| state 字段 | 类型 | 含义 | 消费点 |
|---|---|---|---|
| `schema_version` | `1` | 固定 | evidence.ts 门禁 |
| `mock` | `true` | 固定 | evidence.ts 门禁 |
| `product` | `Anker737` \| `Soundcore` \| `''` | 已确认型号 | 前端产品卡 |
| `emotion` | `L0`–`L3` | 情绪档位 | 情绪审计 |
| `node` | 故障树节点名 | 当前排障位置 | 决策时间线 |
| `tasks[]` | `{kind, status}` | 本轮任务与状态 | `AuditTimeline` |
| `citations[]` | `{chunk_id, text, metadata}` | 依据快照 | `RetrievalLog` |
| `history[]` | `{from_node, to_node, response?, reason?}` | 排障路径 | 决策时间线 |
| `vision{}` | 见契约 A | 有图时回填，无图为 `{}` | `VisionInspector` |
| `safety_latched` | bool | 安全锁，持续到新会话 | 安全横幅 |
| `ticket` | `{ticket_id, dispatched}` | 模拟工单 | 交接卡 |
| `transfer_summary` | `{reason, ...}` | 交接摘要 | `HandoffTicketModal` |

**规则**：无图时 `vision` 必须是 `{}`，不得留上一轮的残留值。

---

## 契约 C：前端渲染依赖

| 前端字段 | 取值来源 | 现状差距 |
|---|---|---|
| `visionEvidence.product_model` | `evidence.vision.product_model`，缺失时回退 `state.productModel` | ❌ `SidePanel.tsx:44` 写死兜底 `'Anker 737'` |
| `visionEvidence.fault_phenomenon` | `evidence.vision.fault_phenomenon` | ❌ 现读 `ev.vision.phenomenon`（字段名与语言都不符） |
| `visionEvidence.confidence` | `evidence.vision.confidence` | ❌ 缺失时 `SidePanel.tsx:47` 写死 `0.88` |
| `visionEvidence.is_anker_product` | `evidence.vision.is_anker_product` | ❌ `useEventParser.ts:234` 硬编码 `true` |
| 视觉置信度阈值 | 与 engine 一致 | ❌ 前端 0.75 / engine 0.8 |

**规则**：**没有真实数据时显示"待提取/未识别"，不得编造数值。**（文案可以保留 demo 表达，但数值与状态必须来自真实链路。）

---

## 契约 A/B/C 的对照检查清单（改完必须逐条勾）

- [ ] A：YAML 输出 `is_anker_product`、`brand`，现象改为中文 `fault_phenomenon`
- [ ] A：`product` 可由 `vision.product_model` 设定
- [ ] A：安全类现象不要求置信度门槛
- [ ] B：无图时 `vision` 为 `{}`
- [ ] C：`fault_phenomenon` 字段名与语言三端一致
- [ ] C：置信度阈值三端统一（建议 0.8）
- [ ] C：缺失值显示"未识别"，不写死数值
- [ ] 三端：字段名逐一 grep 比对，无孤儿字段

## 验收基线

- 文字场景：README 验收表 9 项，须全部通过（2026-09-21 实测已全通过）
- 视觉场景：12 张图按 `frontend/public/test-images/测试清单.md` 36 分制，**目标 ≥30**，03/04/11/12 为必对项
- 2026-09-21 实测：文字 9/9 ✅，视觉 **2/12** ❌
