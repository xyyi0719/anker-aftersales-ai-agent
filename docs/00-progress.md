# 进度日志 · Demo 线

> 本文件由 Demo 线队员滚动维护。每天收工前更新一次状态。
> 格式：日期 / 完成 / 进行中 / 卡点 / 明日计划 / 数字

---

## 2026-09-17（Day 1 · 预赛倒计时 10 天）

### ✅ Dify 联通验证（2026-09-17）
- 后端地址: https://dify.high33light.cn/v1
- API Key: 已配置到 frontend/.env
- 连通性: ✅ 通过 (GET /parameters → 200, POST /chat-messages blocking → 200)
- 流式响应: ✅ 通过 (SSE, 17 个事件，workflow_started/message/node_started/node_finished/message_end/workflow_finished)
- retriever_resource: ✅ 启用（出处锁可工作）
- 文件上传: ❌ Dify App 未开启（需在 Dify 后台 → 功能 → 文件上传 → 开启）
- Chatflow 应用: ⚠️ 仍是默认模板，需手动配置我们的 7 个 prompt

### 🔴 Dify 后台待办（今日必做）
- [ ] 开启文件上传功能
- [ ] 把 7 个 prompt 配置到对应节点（参考 chatflow/README.md）
- [ ] 上传 mock_apis/openapi_spec.json 作为自定义工具
- [ ] 在 Chatflow 开始节点配 inputs 字段（按 chatflow/variable_mapping.md）
- [ ] 注入 fault_tree_json 和 routing_policy_json 作为系统变量

**块 2 服务层**
- [x] 块 2.1 自建检索服务 FastAPI + FAISS + 混合检索 + 置信度
  - `retrieval/app.py` FastAPI 入口
  - `retrieval/chunker.py` 条款边界切片（支持政策/手册/FAQ 三种）
  - `retrieval/embedder.py` M3 Embedding 客户端
  - `retrieval/retriever.py` BM25 + FAISS 混合检索 + RRF 融合 + 置信度
  - `retrieval/config.py` 配置加载（阈值可调）
  - `retrieval/tests/test_retrieve.py` 测试用例
  - `retrieval/data/policies.example.json` 示例政策数据
  - `retrieval/scripts/ingest.py` 知识库入库脚本
- [x] 块 2.2 Mock API × 3
  - `mock_apis/app.py` 统一入口
  - `mock_apis/routes/orders.py` 查订单（GET/POST 双方法）
  - `mock_apis/routes/warranty.py` 查保修（含产品歧义 S1 Pro）
  - `mock_apis/routes/tickets.py` 创建工单（SLA 跟着情绪走）
  - `mock_apis/data/orders.json` 20 条 Mock 订单（含经销商/歧义场景）
  - `mock_apis/openapi_spec.json` Dify 导入用

**块 3 Chatflow**
- [x] 块 3.1 意图分类器 prompt（5 类）
- [x] 块 3.2 排障状态机 prompt（含 vision_skip + forced_retrieve）
- [x] 块 3.3 工具调用闭环 prompt（重试+转话术）
- [x] 块 3.4 转人工结构化摘要 prompt（含 P0/P1/P2 紧急度）
- [x] Chatflow 变量映射文档
- [x] Chatflow 故障树模板（占位，待 1.4 替换）
- [x] Chatflow 政策路由表模板（占位，待 1.5 替换）

**块 4 防线与钩子**
- [x] 块 4.1-4.4 幻觉四防线 prompt
- [x] 块 4.5 情绪三级 prompt
- [x] 块 4.6 视觉跳级 prompt（四元组 + ≥0.8 跳级 + 冲突追问）

**块 5 前端工作台**
- [x] Vite + React + TS 项目脚手架
- [x] `frontend/src/App.tsx` 主应用
- [x] `frontend/src/components/ChatWindow.tsx` 流式聊天窗（支持图片上传）
- [x] `frontend/src/components/SidePanel.tsx` 右面板 + Tab 切换
- [x] `frontend/src/components/TaskList.tsx` 任务列表 + 状态卡片
- [x] `frontend/src/components/RoutingPath.tsx` 路由路径时间线
- [x] `frontend/src/components/EmotionChart.tsx` 情绪曲线 SVG 图表
- [x] `frontend/src/components/RetrievalLog.tsx` 检索日志（带置信度分级）
- [x] `frontend/src/hooks/useDifyChat.ts` Dify 流式 chat 封装
- [x] `frontend/src/hooks/useEventParser.ts` agent_thought 事件解析
- [x] `frontend/src/styles.css` 完整暗色主题样式
- [x] 演示钩子快捷按钮（看图跳级 / S1 Pro 歧义 / 暴怒升级 / 政策检索）

**知识库 + 文档**
- [x] `knowledge_base/README.md` 知识库目录结构
- [x] `docs/01-architecture.md` 架构图 + 数据流
- [x] `docs/02-decisions.md` 8 条关键决策记录
- [x] `docs/guides/QUICKSTART.md` 5 分钟启动指南

### 🟡 进行中（待验证 / 待素材）
- 块 2.4 知识库灌库：脚本就绪，需要 1.1 政策文本 + 说明书
- 块 3.2 排障状态机：模板就绪，需要 1.4 故障树 JSON
- 块 4.6 视觉跳级：prompt 就绪，需要 1.3 五张照片

### ⚠️ 卡点（必须催队长的）
- 🔴 块 1.4 故障树 JSON × 2（Anker 737 + Soundcore 耳机）— 9.19 晚前必须给
- 🟡 块 1.3 五张故障测试照片 — 9.23 晚前必须给
- 🟡 块 1.2 差评语料 30-50 条 — 用于 3.1 意图分类器测试 + 7.1 回归
- 🟢 块 1.1 政策文本 — 用于 2.4 知识库灌库

### 📋 明日计划（9.18）

**优先级 1：服务跑通**
1. `mock_apis` 本地启动，三个 API 用 curl 各调一次
2. `retrieval` 本地启动，导入示例数据，测试 `/retrieve`
3. `ingest.py` 跑通，验证入库流程

**优先级 2：Dify 工具对接**
4. 把 `mock_apis/openapi_spec.json` 导入 Dify 自定义工具
5. 三个工具各在 Dify 手动调通一次

**优先级 3：补素材**
6. 从示例政策（policies.example.json）扩展到至少 5 篇真实 Anker 政策
7. 准备 20 个真实问法的测试集（用队长语料，或自己从差评里抽）

### 📊 数字

| 指标 | 当前 | 目标 | 状态 |
|---|---|---|---|
| Demo 线任务 | 10/15 | 15/15 | 🟢 |
| 代码文件 | 47 个 | - | - |
| prompt 文件 | 7 个 | 7 个 | ✅ |
| 前端组件 | 6 个 | 6 个 | ✅ |
| 文档文件 | 5 个 | - | - |
| Mock API 调通 | 0/3 | 3/3 | ⏳ 明日验证 |
| 检索命中率 | 待测 | ≥80% | ⏳ 明日测试 |

### 🎯 今日里程碑达成
- ✅ 项目结构搭建
- ✅ 检索服务代码骨架完成
- ✅ Mock API 代码骨架完成
- ✅ Chatflow 全部 prompt 草稿完成
- ✅ 决策记录 8 条
- ✅ 快速启动指南完成
- ✅ React 前端工作台完整 UI + 流式响应 + 4 面板联动

---

## 数字速查（持续更新）

| 指标 | 当前 | 目标 | 截止 |
|---|---|---|---|
| Demo 线任务 | 9/15 | 15/15 | 9.26 |
| 检索命中率 | 待测 | ≥80% | 9.18 |
| Mock API 调通 | 0/3 | 3/3 | 9.18 |
| 冒烟通过 | ❌ | ✅ | 9.21 |
| 决定性瞬间截图 | 0/3 | 3/3 | 9.25 |

---

## 2026-09-18（待填）

### ✅ 完成
- [ ] 块 2.1 检索服务本地调通 + 公网化
- [ ] 块 2.2 Mock API 本地调通 + Dify 导入
- [ ] 块 2.4 知识库灌库（≥5 篇政策）
- [ ] 块 3.x Chatflow 节点在 Dify 搭好骨架

### ⚠️ 卡点
（待填）

### 📋 明日计划（9.19）
- 块 3.1 意图分类器在 Dify 验证（用差评语料）
- 块 3.2 排障状态机启动（等 1.4 故障树）
- 准备 20 问法测试集