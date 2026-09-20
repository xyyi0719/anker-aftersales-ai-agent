# 当前离线检索服务

入口 `retrieval.app:app`，核心 `lexical.py`，启动即加载 `knowledge_base/faq_snapshot.json` 的 17 条 FAQ。

不依赖 embedding、FAISS、jieba 或外部 API；采用中文字符二元组/英文词的 BM25 评分及显式口语短语匹配。元数据过滤保留 `product/region/channel`，没有对应元数据不会放宽过滤。

`POST /retrieve` 返回 results/confidence/answerable；`GET /healthz` 返回资料条数和准备状态。policy 类请求应通过 Mock `/api/policy/retrieve` 并带 order_id，以读取一致的订单路由。安全、召回信息缺乏实时可核验依据，返回不可作答。

旧 `embedder.py`、`retriever.py`、`chunker.py`、`config.py` 与灌库脚本为历史向量实验代码，当前入口不加载；不应使用旧 `/index` 灌库流程。未来若恢复向量检索，应另行配置依赖、索引版本与真实评测，不能把哈希向量称为语义模型。
