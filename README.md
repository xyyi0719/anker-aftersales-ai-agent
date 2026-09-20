# Anker 售后 AI 助手

新航无Bug · 安克黑客松智能服务赛道。基于现有 React 工作台、Dify Chatflow 和 FastAPI 服务进行增量完善。

当前版本不需要 embedding 模型或 Dify 知识库。订单、权益与工单使用模拟数据；FAQ 检索、排障状态推进和交接记录实际执行。模型用于意图理解与图片证据提取，售后决策由受限规则控制。

## 本次交付

- `mock_apis/`：原订单数据 + 3 个易于演示的订单；统一核保、政策路由、SQLite 模拟工单、对话规则接口。
- `retrieval/lexical.py`：自动加载 17 条本地 FAQ 的离线 BM25 检索，中文二元组与英文词切分，结合明确口语匹配；没有 embedding 网络请求。
- `knowledge_base/`：可跟随 Git 部署的 FAQ/政策/口语素材快照及可追溯来源。不是实时官方政策。
- `frontend/`：聊天优先，按需展开处理依据；不再编造视觉置信度或显示猜测的办理结果。
- `chatflow/anker-aftersales-chatflow.yml`：主流程；`anker-offline-debug.yml` 为无模型文字联调版本。
- `docs/reviews/参赛方案审核.md`：按官方模板审核主张与实现证据；`docs/CHANGELOG.md` 记录全部变更与验证边界。

## 本地运行

需要 Python 3.11+、Node.js 22。

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements-test.txt
python -m pytest tests -q
uvicorn mock_apis.app:app --host 127.0.0.1 --port 8002
```

未设置 `RETRIEVAL_URL` 时 Mock 服务直接调用同一离线检索实现；部署时通过 HTTP 使用独立检索容器。独立启动：

```bash
uvicorn retrieval.app:app --host 127.0.0.1 --port 8001
```

前端开发：复制 `frontend/.env.example` 为 `frontend/.env`，配置 **服务端** `DIFY_API_KEY`，然后在 `frontend/` 执行 `npm ci && npm run dev`。密钥不使用 `VITE_` 前缀，不进入浏览器包。

## Dify 导入（不会自动改线上流程）

1. 备份线上应用 DSL，再导入 `chatflow/anker-aftersales-chatflow.yml` 创建测试应用。应用类型是 **Chatflow / advanced-chat**。
2. `MOCK_API_BASE_URL` 默认为 `http://anker-demo-api:8002`，对应本仓库部署后的网络别名。与旧的 `mock-apis` 服务名区分，避免影响旧流程。
3. 保留了原 YAML 的 MiniMax 模型配置；在 Dify 核实模型与视觉能力是否可用。无需配置 embedding 或知识库。
4. 默认 Mock 接口只在 Docker 网络内开放；如果设置 `MOCK_API_KEY`，同步填写 Dify 环境变量。
5. 测试后发布新流程。若创建了新应用，则更新 GitHub `DIFY_API_KEY` Secret 后重新运行 Actions；如果在原应用更新，保留原应用接口配置。

Dify 原生调试输出会包含供工作台解析的 `__EVIDENCE_V1__` 标记。工作台隐藏标记，只展示用户答复和按需展开的结构化依据。HTTP 失败时不虚称已核保/建工单，保留原会话状态。

## 部署与 ZIP

沿用 `.github/workflows/deploy-frontend.yml`、现有服务器 Actions 凭据及 `/home/ubuntu/workbench-deploy` 前端位置。流水线先验证再部署：

1. Python 回归、前端构建、生成 ZIP 与 SHA256。
2. 验证 Compose 配置并构建后端镜像。
3. 使用既有 SSH Secrets 上传前端与新增服务；在现有 Docker 网络上启动 `anker-demo` 独立 Compose 项目。
4. 更新前端 Nginx 代理，验证 Nginx、首页和服务健康。

所需 Secrets：原有 `SERVER_HOST`、`SERVER_USER`、`SERVER_SSH_KEY`，以及 `DIFY_API_KEY`。旧仓库出现过明文应用密钥，本次从源码移除并迁至 Secret；历史记录中的旧值仍需要在 Dify 更换。

本地打包与 CI 共用：

```bash
cd frontend
npm ci
npm run build
cd ..
python scripts/package_release.py
```

生成 `release/anker-aftersales-release.zip`、`SHA256SUMS`。ZIP 包含已构建前端、后端、资料、流程、文档和文件哈希清单，排除密钥、虚拟环境、工单数据库与 Git 历史。不是包含 Docker 镜像和离线依赖的安装包；服务器首次构建需要联网。

## 演示验收

| 场景 | 输入 | 预期 |
|---|---|---|
| 排障状态 | Anker 737 充不进电 → 自己 → 仍不行 → 黑屏 | 状态依次推进，最后生成模拟交接 |
| FAQ | 耳机单边没声音 | 命中 S1，附资料快照来源 |
| 核保 | DEMO-US-001 保修多久 | 按订单读取美国官网模拟规则 |
| 渠道 | DEMO-AMZ-001 退货 | 退款渠道为亚马逊，避免直接承诺 |
| 中国区 | DEMO-CN-001 保修多久 | 中国区模拟规则 |
| 召回 | 这个型号有召回吗 | 缺乏实时依据，升级；不声称没有召回 |
| 安全 | Anker 737 鼓包了 | 停止使用，安全状态锁定，生成模拟工单 |
| 消歧 | 我的 S1 Pro 不吸了 | 先确认品类；未支持品类转专员 |
| 多意图 | Anker 737 充不进电还想保修 | 排障与核保各自显示任务状态 |

当前静态测试不等于线上 Dify/视觉端到端验收。真实模型看图、线上导入、真实客服接单都不能以本地单测代替。
