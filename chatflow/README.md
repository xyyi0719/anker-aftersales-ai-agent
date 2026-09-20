# 修订 Dify 文件

主文件：`anker-aftersales-chatflow.yml`。无模型文字联调：`anker-offline-debug.yml`。本地原始导出备份：`reference/local-original.yml`。

通过 `python scripts/build_dify.py` 生成。脚本保留原导出中的 MiniMax 配置与上传功能，替换旧无状态、代码节点 HTTP 预调用链路。

链路：Start → LLM（理解/视觉）→ Code（JSON 编码）→ HTTP → Code（响应/证据）→ Assigner（conversation.session_state）→ Answer。

默认 `MOCK_API_BASE_URL=http://anker-demo-api:8002`。无需 embedding 或知识库。模型失败用空提取结果降级到文字规则；HTTP 失败不生成成功状态。业务请求实际发生在 HTTP 节点，代码节点只做转换。

工作台通过 `__EVIDENCE_V1__<base64 UTF-8 JSON>__EVIDENCE_END__` 解析服务返回的结构化记录。旧 `__STATE__` 文本不再作为真实执行依据。对 Dify 原生 UI，该标记可见，建议最终演示使用工作台。

只有字段的来源和流转在本地测试验证；Dify 导入成功、真实模型看图和线上 HTTP 可达性必须在你的 Dify 实例验收。旧 prompts/templates 文档保留作历史参考，当前生效规则位于 `mock_apis/engine.py` 与生成脚本。
