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
