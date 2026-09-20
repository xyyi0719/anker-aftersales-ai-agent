# Anker 智能售后 AI Agent

> **Anker 首届黑客松（2026）参赛作品 · 赛道 04「智能服务 — 真正听懂，真正解决」**
>
> 团队：**新航无Bug**
>
> 一个面向真实售后场景的 AI 智能客服 Agent，结合用户文本、故障图片、技术知识库与历史工单信息，完成情绪识别 / 产品消歧 / 故障定位 / 排障引导 / 升级处理的全链路。

---

## ✨ 项目亮点

### 1. 「幻觉四道防线」

| 防线 | 实现 |
|---|---|
| **流程锁** | 召回类 / 质保类问题强制检索，禁止自由发挥 |
| **出处锁** | 政策类回答强制带条款号 + chunk_id 可点击追溯 |
| **置信度锁** | 检索低置信度（top1_score 偏低、gap 太小、BM25 无命中）触发固定「我暂时没把握」升级话术 |
| **权限锁** | 工具白名单仅 `query_order` / `check_warranty` / `policy_retrieve` / `create_ticket`，退款/支付/承诺类一律不允许 |

### 2. 6 类意图 + 情绪三级

- 意图：故障排障 / 政策咨询 / 退换货 / 转人工 / 投诉 / 范围外
- 情绪：normal / upset / angry / complaint — 升级时附带结构化交接摘要（问题 / 定位结论 / 已尝试 / 订单号 / 情绪等级 / 工具调用数）

### 3. 多模态视觉跳级

- 用户上传故障图 → LLM 抽取四元组（型号 / 位置 / 现象 / 置信度）
- confidence ≥ 0.8 且匹配已知故障树 → 直接跳级到对应排障步骤
- safety_hazard（鼓包 / 漏液 / 起火 / 烧灼 / 焦黑）→ 强制安全警告 P0 升级
- 非 Anker / Soundcore / eufy 品牌（Baseus / 小米 / 罗马仕）→ 礼貌拒答

### 4. 混合检索 + 置信度三重判定

- FAISS 向量 + BM25 关键词 → RRF 融合
- confidence = 绝对 top1_score（不是平均） + gap (top1-top2) + BM25 命中率
- 12 张图测试 100% 通过率（含 Baseus 拒答）

---

## 📊 关键测试指标

| 维度 | 数值 |
|---|---|
| 12 张图视觉测试通过率 | **100%** (12/12) |
| must-pass 安全图（03/04 鼓包） | **100%** 触发安全升级 |
| must-pass 拒答图（11/12 Baseus） | **100%** 正确识别 |
| 12 用例回归 smoke | 12/12 PASS（含 retry） |
| 知识库 chunks 数 | 53（5 政策 + 17 FAQ + 25 口语映射 + 3 真实投诉 + 3 配置）|

---

## 🏗️ 架构

```
┌──────────────────────────────────────────────────────────────┐
│                    React + TypeScript 工作台                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ ChatWindow   │  │ StatusCards │  │ RetrievalLog│            │
│  │ (SSE 流式)   │  │ 意图/情绪/  │  │ 出处锁 UI  │            │
│  │             │  │ 产品/路径    │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└────────────────────────────┬─────────────────────────────────┘
                             │ POST /chat-messages
                             │ (5 字段纪律)
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                    Dify Chatflow (15 节点)                      │
│  Start → emotion → intent → tool_dispatch → vision_extract    │
│         → router(6 类) → 6 handler → aggregator → answer      │
│                                                              │
│   • 工具调度: code_node 预调 (mock_apis / 检索 / 视觉)           │
│   • 多模态: vision_extract LLM + 视觉证据处理                    │
│   • 记忆: 8 个 LLM 节点 memory.window enabled size=10         │
└──────────┬─────────────────────────────────┬─────────────────┘
           ↓                                 ↓
┌─────────────────────┐         ┌──────────────────────────┐
│  Mock APIs           │         │ 混合检索服务                  │
│  • /orders           │         │  FAISS + BM25 + RRF       │
│  • /warranty         │         │  53 chunks 知识库           │
│  • /tickets          │         │  置信度三重判定               │
│  • /policy/retrieve  │         └──────────────────────────┘
└─────────────────────┘
```

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 5（无 UI 库，纯手写 CSS）|
| 工作流编排 | 自托管 Dify 1.17.1（社区版） |
| LLM | MiniMax-M3（验证：工具链 / 图片 / 延迟）|
| 检索 | FAISS（向量）+ BM25（关键词 jieba 分词）+ RRF 融合 |
| 服务 | FastAPI + Uvicorn + Pydantic |
| 容器化 | Docker + Docker Compose（multi-service add-on）|
| 部署 | Nginx Alpine 反向代理前端 + 服务 Docker 网络互联 |

---

## 📁 目录结构

```
.
├── README.md                          # 本文件
├── Anker售后.yml                       # Dify 0.7 参考模板（队友上传）
├── 新航无Bug参赛任务手册V4(1).md       # 队长维护的任务手册
│
├── chatflow/                          # Chatflow DSL + prompts
│   ├── anker-aftersales-chatflow.yml  # 主 DSL（15 节点，4.2 P0+P1）
│   ├── prompts/                       # 8 个 LLM 节点系统提示词
│   ├── templates/                     # 故障树 + 政策路由示例
│   └── variable_mapping.md            # 变量映射文档
│
├── frontend/                          # React + TS 工作台
│   └── src/
│       ├── App.tsx                    # 主布局：聊天窗 + 状态卡 + 6 面板
│       ├── components/                # 8 个组件
│       │   ├── ChatWindow             # SSE 流式消息渲染
│       │   ├── StatusCards            # 6 卡片状态栏
│       │   ├── SidePanel              # 任务/路由/情绪/检索
│       │   ├── TaskList               # 多意图任务拆分
│       │   ├── RoutingPath            # 路由路径时间线
│       │   ├── EmotionChart           # 情绪变化曲线
│       │   ├── RetrievalLog           # 出处锁 UI
│       │   └── TransferSummary        # 转人工摘要卡
│       ├── hooks/
│       │   ├── useDifyChat            # 5 字段纪律 + AbortController
│       │   └── useEventParser         # __STATE__ 解析 + 实时状态更新
│       └── utils/inference.ts         # 前端关键词分类（fallback）
│
├── retrieval/                         # 混合检索服务
│   ├── app.py                         # FastAPI 入口 (/retrieve, /index)
│   ├── retriever.py                   # FAISS+BM25+RRF + 置信度三重判定
│   ├── chunker.py                     # 政策/手册/FAQ 分片器
│   ├── embedder.py                    # M3 Embedding + 离线 fallback
│   ├── config.py
│   └── scripts/
│       ├── seed_demo.py               # 4 文档 demo 灌库
│       └── seed_material_library.py   # 53 chunks 真实素材灌库
│
├── mock_apis/                         # 售后 Mock API 服务
│   ├── app.py
│   ├── openapi_spec.json              # OpenAPI 3.x 定义（Dify 工具导入用）
│   ├── routes/                        # orders / warranty / tickets / policy
│   └── data/orders.json               # 20 条种子订单
│
├── docker/                            # Docker 镜像构建
│   └── services/                      # mock_apis + retrieval 一体化镜像
│
├── docs/                              # 项目文档
│   ├── 00-progress.md                 # 开发进度
│   ├── 01-architecture.md             # 架构详解
│   ├── 02-decisions.md                # 技术决策记录
│   └── guides/                        # 各类指南
│
├── knowledge_base/                    # 知识库说明
└── 素材库/                             # captain 提供的真实素材
    ├── FAQ/                           # 官方 FAQ + 差评语料映射
    ├── 售后政策/                       # 中美欧三包政策
    ├── 配置/                           # 故障树 + 政策路由 JSON
    ├── 产品说明书/                     # PDF 产品手册（Anker 737）
    └── 图片/测试集/                    # 12 张测试图
```

---

## 🚀 快速开始（本地开发）

### 前置依赖

- Node.js 18+
- Python 3.11
- Dify 0.7+ 自托管实例
- MiniMax M3 API Key

### 启动检索服务

```bash
cd retrieval
pip install -r requirements.txt
python scripts/seed_material_library.py    # 灌库
python app.py              # 启动 :8001
```

### 启动 Mock API

```bash
cd mock_apis
pip install -r requirements.txt
python app.py             # 启动 :8002
```

### 启动前端

```bash
cd frontend
cp .env.example .env      # 配置 DIFY_API_KEY
npm install
npm run dev               # 启动 :5173
```

### Dify Chatflow 导入

打开 Dify Studio → 「···」→ 导入 DSL → 选 `chatflow/anker-aftersales-chatflow.yml` → 覆盖

---

## 🎯 决赛 / 后续方向

- 接入真实 Anker 工单系统 API（替换 Mock）
- 多语言支持（英文 / 日文 — Anker 海外业务）
- 历史工单召回（结合用户 ID）
- 端到端 P95 延迟 < 2s 优化
- 工单知识库自动更新管道

---

## 📝 参赛信息

- **赛事**：Anker 首届黑客松（2026.09.07 ~ 10.26）
- **赛道**：04 智能服务 — 「真正听懂，真正解决」
- **团队**：新航无Bug（2 人）
- **作品亮点**：自托管 Dify + M3 + React 工作台 + 「幻觉四道防线」+ 多模态视觉
- **报名时间**：2026-09-07
- **预赛材料提交**：2026-09-27 23:59
- **决赛**：2026-10-16 ~ 10.17（深圳，24H 开发 + 路演）

---

## 📄 License

本仓库用于 Anker 首届黑客松参赛作品展示，仅供学习交流使用。