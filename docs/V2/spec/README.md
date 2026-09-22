# V2 Spec 索引

> 阅读顺序：`../00-改造总纲.md`（为什么改）→ `00-契约冻结.md`（接口定死）→ 自己那组的 spec（怎么改）。
> 每份 spec 固定五段：**目标 / 输入依赖 / 产出物 / 验收指标与标准 / 边界**。

---

## 1. 分工（按契约边界切，两人文件不重叠）

| 组 | 负责目录 | spec |
|---|---|---|
| **A · 后端与 Dify** | `mock_apis/`、`chatflow/`、`tests/`、`scripts/` | A1–A4 |
| **B · 前端** | `frontend/src/` | B1–B4 |
| **文档负责人** | 不写代码，只维护交付文档 | `../01-文档待改清单.md` |

**注意**：**参赛方案的修订不属于 A/B 两组的交付范围**，由文档负责人单独执行。
两组只需把产出物交出来：V2 三层看板截图、评测指标数值、线上可访问链接。

**文件纪律**

- A 组**不许改** `frontend/src/`；B 组**不许改** `mock_apis/`、`chatflow/`、`tests/`。
- 唯一例外是联调期，且必须在 PR 说明里写明原因。
- `styles.css` 只归 B 组。
- 方案正文（`docs/reviews/`）只有文档负责人能改。

---

## 2. 依赖顺序与关键路径

```
① A 组先单独完成「契约冻结」（00-契约冻结.md）        ← 唯一的串行点，半天量
        ↓ 冻结后
② A、B 并行开工
        ↓ 各自验收通过
③ C 合并审核（C-合并审核.md），交叉审
```

**不要把「A 组全做完」当串行点。** 契约冻结之后就是纯并行。

**工作量提示**：B 组（前端三层重构）约为 A 组的 1.5–2 倍。A 组完工后接手**联调协助**。
文档修订由文档负责人独立推进，不占用两组的工期。

---

## 3. 分包清单

| spec | 组 | 依赖 | 验收命令 |
|---|---|---|---|
| `00-契约冻结.md` | A | — | `python scripts/check_contract.py` |
| `A1-规则服务输出.md` | A | 00 | `python -m pytest tests -q` |
| `A2-模拟数据与动作接口.md` | A | 00 | `python -m pytest tests -q` |
| `A3-Dify提示词与流程.md` | A | 00 | `python -m pytest tests/test_dify.py -q` |
| `A4-评测脚本与指标.md` | A | A1、A2 | `python scripts/eval_metrics.py` |
| `B1-三层看板.md` | B | 00 | `node browser-check.mjs` |
| `B2-对话区改造.md` | B | 00 | `node browser-check.mjs` |
| `B3-工单流程与转派.md` | B | A2 | `node browser-check.mjs` |
| `B4-文案清理与样式.md` | B | — | `npm run build` + `node browser-check.mjs` |
| `C-合并审核.md` | A+B | 全部 | 见该文件门禁清单 |

---

## 4. 契约变更流程

`00-契约冻结.md` 是唯一真源。任何字段的增删改：

1. 在该文件末尾「变更记录」里加一行，状态写 `提议`
2. 双方确认后改为 `已确认`
3. 双方各自改自己那端，跑 `check_contract.py`

**禁止**：单方面改自己那端去迁就另一端。发现对方与契约不符 → 提出来，不要自己绕过。

---

## 5. 合并门禁（C 阶段，全过才放行）

1. `python -m pytest tests -q` 全绿
2. `npm run build` 无报错
3. `node browser-check.mjs` 全绿
4. `python scripts/check_contract.py` 通过
5. `python scripts/eval_metrics.py` 产出三个指标并记录数值
6. 5 条演示剧本人工走通（`../02-验收与指标.md` §2）
7. `../03-前端改造清单.md` §5 的文案清理逐条勾对
8. 在 Dify 平台绕开前端验一次真实模型输出

---

## 6. 防变形的三道机制

| 机制 | 落点 | 作用 |
|---|---|---|
| 契约冻结 + 变更登记 | `00-契约冻结.md` | 接口只有一个真源 |
| **契约一致性自动检查** | `scripts/check_contract.py` | 三端字段不一致时 CI 直接失败 |
| 目录越界纪律 + 交叉审核 | 本节 §1 + `C-合并审核.md` | 谁都不改对方那端 |

第 2 条是核心：**把纪律变成会失败的检查**，而不是靠人记得。

---

## 7. 本轮前端提交后的遗留问题（待确认 / 待 A 处理）

> 由 B 组在实现本次前端改造时发现并记录，均在代码里保留了降级行为，不阻塞合并。

| # | 问题 | 影响 | 归口 |
|---|---|---|---|
| 1 | `state.intents` / `state.user` 未产出（`domain.user_profile()` 已实现但无路由调用） | 中层「用户档案」显示「未识别」；用户气泡的「理解为」缺意图 | A（已在 `00-契约冻结.md` 变更记录登记为提议） |
| 2 | S1 Pro 消歧的 `product/waiting_user` 任务不返回 `options` | 线上该追问不会出现「快速模拟对话」气泡，仍需手打 | A |
| 3 | `/mock-api` 代理未注入 `MOCK_API_KEY` | 若线上启用该 Key，转派按钮返回 401 → 只显示「提交失败，请重试」 | A（见 `B3-工单流程与转派.md`） |
| 4 | `read_text()` 未指定 `encoding='utf-8'`（`domain.py`、`scripts/*.py`、`tests/*.py`） | 中文 Windows 上 `UnicodeDecodeError`，要 `PYTHONUTF8=1` 才能跑测试 | A |
| 5 | 本地 `test_openapi_spec_is_current` 失败 | 本地 pydantic 2.13.5 / fastapi 0.141.1 高于仓库固定（2.11.4 / 0.115.12），运行时 openapi 多了 `ctx`/`input`；CI 固定版本可通过 | A |
| 6 | `docs/03-contract.md`（v1 契约）已被 `docs/V2/spec/00-契约冻结.md` 取代 | 两份契约并存，改错那份就会变形 | 文档负责人 |
| 7 | `docs/00-progress.md`、`docs/CHANGELOG.md` 仍是旧进度与旧口径 | 与当前实现、测试结果不符 | 文档负责人 |
