# 2026-09-20 增量变更记录

## 已确认范围

用户确认：以现有 GitHub 项目为主，合入本地新增 Mock、精简前端、修改本地 Dify YAML、审核参赛文档，保留 ZIP 交付。授权测试后推送，利用原有 Actions 查看部署。未授权自动覆盖线上 Dify，故仅提交 DSL 文件。

## 对比基线

- GitHub 基线提交：`909dbd7`，已有前端自动部署；最近一次检查到的 Actions 运行 `35515177460` 成功。
- 本地原始 Mock：Flask 单文件、3 笔订单、16 条 FAQ/政策混合数据。
- GitHub Mock：FastAPI、20 笔订单、工单内存存储，政策代理到独立检索。
- 采用 GitHub FastAPI 服务，不引入第二套 Flask 服务；本地 FAQ 内容扩充为完整 17 条并保留来源。
- 本地原始 YAML 已保存于 `chatflow/reference/local-original.yml`。两份旧流程都有无会话变量、代码节点网络请求、写死核保参数等问题。

## 变更清单

1. 离线检索：移除部署所需的 embedding / FAISS 依赖，自动加载仓库快照，保留 `/retrieve` 和 `/api/policy/retrieve` 接口。明确 BM25 实现是 CJK 二元组与英文词切分，不假称 jieba 分词或 RRF。
2. 数据合并：保留原 20 笔订单，加入 DEMO-US/AMZ/CN 三笔；删除过时的静态 `warranty_status` 和 `warranty_expires`，按订单与月份计算；请求中的伪造购买日期不参与核保。
3. 政策：配置集中维护；条件规则优先，未知区域/渠道不误套中国规则；仅返回模拟权益，未知权益为 `null`，不当作过保。
4. 工单：SQLite 持久化、同会话幂等、交接摘要记录最新步骤，明确未派给真实客服。
5. 排障：有限状态推进、明确回复匹配、可选 AI 回答归一；安全锁持续到新会话，视觉仅辅助现象确认，低置信度/冲突不能跳过动作核验。
6. Dify：7 节点主链（输入、AI 理解、编码、HTTP、响应校验、赋值、回答），会话变量持久化，HTTP 失败降级；无知识库或 embedding 配置。保留原模型提供商，实际视觉能力待线上验证。
7. 前端：聊天主视图、四个文字示例、可折叠依据面板、有效 JPG/PNG 上传、输入法 Enter 防误发、按会话独立访客 ID、等待与错误状态。删除图片占位按钮与硬编码 0.85 证据；不再自动重试整个办理请求，避免重复创建业务。
8. 接口凭据：原明文 Dify 应用密钥迁到 Actions Secret，前端同源代理；Git 历史中的旧值仍需在 Dify 轮换。
9. Actions：沿用原服务器 Secrets、目录及前端容器，新增 validate 作业和独立 anker-demo 服务项目；生成统一 ZIP 制品，Dify 不自动导入。
10. 文档：README 更新为实际使用方式；另附参赛方案审核，对无依据的完成率、得分和晋级概率作纠正。

## 本地验证

- Python：42 项回归通过（本地 Python 3.12）；CI 用 Python 3.11 再验证。
- YAML：代码节点编译、请求 JSON 转义、错误降级、结构化证据解码、会话赋值与节点连通性检查通过。
- 视觉：仅测试构造的结构化证据阈值与冲突，未宣称真实图片识别通过率。
- 前端生产构建通过。桌面 1440px、手机 375px 浏览器检查通过：无横向溢出、消息发送、结构化依据显示、原始标记隐藏、新会话重置、输入法 Enter 不误发、无 JS 异常。
- 浏览器验收使用模拟 Dify HTTP 响应，截图保存在 `docs/screenshots/`；这些不是线上模型效果截图。
- 首次浏览器检查发现 React effect 返回值导致页面空白，已修正为不返回滚动调用结果，并重新验收通过。
- ZIP 与 SHA256 使用统一脚本生成；推送和 Actions 结果在完成后补记。

## 部署边界

仅通过 GitHub Actions 部署，不使用用户没有权限的服务器交互。新增服务采用 `anker-demo-api` 网络别名，避免覆盖旧 `mock-apis`。本地没有 Docker CLI，容器构建和网络检查交由 Actions 执行。线上 Dify 是否已导入新 YAML、模型是否可用、HTTP 节点是否受代理策略限制，均须在 Dify 平台测试。

## 2026-09-21 推送状态

- 实现提交：`e62a36f`。工作区测试与 ZIP 检查完成。
- ZIP 校验：80 个文件的 SHA256 与 MANIFEST 一致，压缩包完整性通过；不包含 .env、虚拟环境、工单数据库或真实密钥。
- 首次推送被 GitHub 拒绝，原因是当前 OAuth 登录缺少修改 `.github/workflows/deploy-frontend.yml` 所需的 `workflow` scope。远端尚未收到实现提交，因此新部署尚未触发。
- 已发起 `gh auth refresh -h github.com -s workflow`，等待账号持有人完成 GitHub 设备授权。完成授权后继续推送并检查 Actions。
- Dify 应用 Secret 已配置成功，服务器原有三个 Secret 名称已确认存在；未读取或输出服务器凭据。

## 2026-09-21 首次 Actions 验证与修复

- GitHub 授权完成，`7dc8197` 已成功推送到 main。
- Actions `35550069806` 的 validate 作业全部通过：Python 测试、前端构建、浏览器验收、ZIP、Compose 校验和 Docker 镜像构建。
- deploy 在 Copy release 阶段失败：SCP action 容器无法读取 runner 中权限为 0600 的发布包；服务器部署脚本未执行。
- 修复方式：发布包只含无密钥模板与代码，恢复可供上传容器读取的普通文件权限；Dify Secret 通过现有 SSH action 的环境变量传递，在服务器本地生成 0600 Nginx 配置。密钥不再进入发布包或 ZIP。
- 新一轮部署结果随后补记。

## 2026-09-22 恢复视觉测试集弹窗（单入口 · 单一真源）

按用户要求恢复 `1c47738` 撤下的「12 张测试图集」功能，但不恢复当时被判定为自我宣称的文案。

### 变更清单

1. 入口只保留一处：导航栏新增「测试图集」按钮（`App.tsx`），不再恢复聊天区与看图面板的另两个入口。
2. 用例数据升级为单一真源：`mock_apis/data/vision_benchmark.json` 每条补 `file` / `title` 两个展示字段，前端 `frontend/src/data/benchmarkCases.ts` 改由新增的 `scripts/build_benchmark_cases.py` 生成。分类与「期望识别」行均由真源派生，不再手写。
3. 修正与代码行为不符的期望描述：10 号原写「疑似外力破坏」，而 `engine.py` 判的是硬件损坏（需核实型号与购买凭证）；02 号原写「无损伤不跳级」，去除「跳级」说法。
4. 「跳级」口径澄清：`engine.py` 只在现象为「屏幕异常」且置信度 ≥0.8 且型号一致时把节点从 `start` 跳到 `cable`，12 例中没有该现象，因此**任何一例都不会跳过现象提问**。`素材库/图片/测试集/测试清单.md`（gitignored 的本地源料）中 05、06 两行原写「跳级」已改正。
5. 文案去自我宣称：弹窗标题改为「视觉测试集 · 12 例」，说明行写明图片来自公开网页、用于内部回归；不再出现「官方视觉基准测试集」「真机验证图库」。
6. 图片加载失败不再静默：原实现用 `onError` 把 `img` 直接 `display:none`，404 或文件名编码问题会退化成空白卡片；现改为可见的「图片未加载」占位。
7. `frontend/public/test-images/测试清单.md` 移出 public。public 下所有文件会被 Vite 拷进 dist 并由 Nginx 直接提供，该文档在生产环境可通过 `/test-images/测试清单.md` 打开，且内含「仅用于内部测试，不进交付文档」等内部口径。素材库那份保留。
8. 无障碍与响应式：弹窗为 `role="dialog"` + `aria-modal`，打开即聚焦关闭按钮，支持点遮罩 / 关闭按钮 / Esc 三种关闭方式；窄屏（≤1024px）导航按钮收成图标，避免给 375px 导航栏加压。

### 新增测试

- `tests/test_benchmark.py`（19 项）：生成物过期检测、真源完整性（12 条 / id 01–12 / 必需字段）、`file` 必须存在于 `frontend/public/test-images/`、分类由语义派生计数 2/2/6/2、真源不得出现应派生的 `category` 字段、文案守卫（不得声称跳级、不得出现「官方」、不得承诺换新与时长）、`unknown` 渲染为「未识别」。
- `frontend/browser-check.mjs` 增补弹窗段落：卡片数与标题对齐真源、缩略图 `naturalWidth > 0`（懒加载先滚一遍再判定，可抓 404 与中文文件名编码失败）、分类筛选、Esc 关闭、点选用例后发出的提问与真源一致且带一张图片、打开态的弹窗文本扫描禁用措辞。

### 本地验证

- Python 回归：在按 `requirements-test.txt` 固定的依赖下（fastapi 0.115.12 / pydantic 2.11.4），以 CI 的口径 `python -m pytest -q`（含 `retrieval/tests`）实测 **151 项全部通过、0 失败**。为此专门建了一个固定版本的虚拟环境核对，CI 的 validate 作业不会红。
- 本机（pydantic 2.13.5）会看到 `test_openapi_spec_is_current` 失败：高版本 pydantic 给 `ValidationError` schema 多加了 `ctx` / `input`，与仓库里按 2.11.4 生成的 `mock_apis/openapi_spec.json` 不一致。**不要用本机版本重生成该文件**——本次一度重生成，那 7 行差异恰好会让 CI 反过来失败，已回退，并在 `docs/V2/spec/README.md` 遗留问题第 5 条补了这条禁令。
- 契约检查通过；`scripts/eval_metrics.py` 三项指标未回退（诱导 10/10、规则层 26/26、看图行为 12/12）。
- 前端生产构建通过；Puppeteer 浏览器验收通过（桌面 1440px / 手机 375px、无横向溢出、无 JS 异常、新增弹窗段落全通过）。截图已随验收更新到 `docs/screenshots/`。

### 边界

- 弹窗只展示真源里的标注，**不代表真实视觉识别效果**：脚本喂给引擎的是人工标注的正确提取结果，「看图行为正确率」不等于「视觉识别准确率」。
- 文件名 `01_正常-Anker737官方产品图.jpg` 仍含「官方」字样。它只出现在 `img` 的 URL 与真源字段里，不进界面文案（`alt` 用 `title`），改名会牵动素材库与 git 历史，本次未改。

## 2026-09-22 文档与代码一致性清理

起因：核对文档与代码的偏差。以下每条的判据都是「代码是权威，文档跟代码」。

### 死代码

1. 删除三个无引用组件：`HandoffTicketModal.tsx`、`TransferSummary.tsx`、`TaskList.tsx`（全仓 grep 零引用，且不在打包产物里，删除后 JS 体积不变）。
2. 清理 `styles.css` 无引用规则：2325 → 1523 行，删除 109 条规则、3 处孤立段落注释，CSS 产物 32.81 kB → 22.16 kB。
   判定方式保守：类名在 `frontend/src` + `index.html` + `browser-check.mjs` 里出现过就保留；含元素名、属性选择器、伪类残留的选择器一律不动；`@keyframes` 内层不碰。清理后复核「被删掉的、但仍被源码引用的类名」为 **0**，大括号配平，两个 `@keyframes` 完整。
3. 删除 `chatflow/prompts/07-vision-skip.txt`。它是孤儿：`scripts/build_dify.py` 只读 `08-extract-vision.txt` 与 `09-compose-answer.txt`。但它自称「视觉识别与跳级决策器」，还挂着一张 5 张照片的旧「期望四元组」表，现象词又是第三套（正常/烧灼/鼓包/指示灯异常/裂痕/异色/进水痕迹），留着只会误导。唯一引用它的 `docs/03-contract.md` 同步处理。

### 契约文档

4. `docs/03-contract.md` 改为废止说明 + 差异对照表。它是 v1 草案（自标「状态：待实现」），此后字段名（`phenomenon` → `fault_phenomenon`）、阈值（0.75 → 0.8）、现象枚举（英文五值 → 中文十四值）都改过而没同步，还写着「视觉 2/12 ❌」而实测是 12/12。`docs/V2/spec/README.md` 遗留问题第 6 条早就记录「两份契约并存，改错那份就会变形」。保留文件只为不给旧链接留断链。`mock_apis/engine.py:11` 与 `tests/test_contract.py:1` 的引用一并改指冻结契约。

### 过时文档

5. `docs/01-architecture.md` 加「设计期方案，不是现状说明」抬头，并补文末「设计期方案 → 现状对照」表：FAISS 混合检索 → 离线 BM25；三个 Dify 自定义工具 → 单个 `/api/chat/turn` HTTP 节点；意图分类/状态机/工具调用的多节点 → 八节点单链；`inputs` 传参 → 恒空 + 会话变量；流式事件 → `blocking` + `__EVIDENCE_V1__` 标记；「四元组」→ 契约 A 实为七个字段。
6. `docs/02-decisions.md` 校订 D-006、D-007 的「实现」行——原文指向不存在的代码（`warranty.py` 的 `PRODUCT_AMBIGUOUS`、chatflow 节点 1.5、`tickets.py` 的 `sla_days`），改为实际落点，并显式标出**未实现「情绪 → SLA」**这一事实。
7. `docs/FRONTEND_REDESIGN_PLAN.md` 加历史文档抬头（它提到的 8 个组件已重写或删除，且全仓零引用）。
8. `docs/V2/02-验收与指标.md` 修正图片格式注记：原文写「11/12 的图片格式需先修」，实测只有 **10 号**是 WebP 名为 `.jpg`，11/12 是正常 JPEG，且不影响渲染与验收。
9. `docs/V2/03-前端改造清单.md`：§5 的 17 个文案清理勾选项逐条核对后全部勾上；修掉 §1 一处指向不存在章节的悬空引用；§6「29 处 benchmark 规则待清」改为本轮的实际清理结果。
10. `docs/V2/spec/README.md` 遗留问题第 5、6、7 条标注处理状态。

### 本轮验证

- 固定依赖环境下 `python -m pytest -q`：**151 passed / 0 failed**。
- `scripts/check_contract.py` 通过；`scripts/eval_metrics.py` 三项指标未回退（10/10、26/26、12/12）。
- `npm run build` 通过；Puppeteer 验收按 CI 的方式跑在 `npm run dev` 起的 4173 上，全部通过（清理 CSS 与删组件后无回归）。
