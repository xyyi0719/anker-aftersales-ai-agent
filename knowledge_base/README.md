# 知识库素材 · 块2.4

> 文档线（队长）负责收集。本目录用于存放所有可入库的素材文件。

## 目录

```
knowledge_base/
├── README.md               # 本文件
├── policies/               # 政策文档
│   ├── anker-737-warranty.md
│   ├── soundcore-liberty-warranty.md
│   ├── eufy-s1pro-warranty.md
│   └── return-policy.md
├── manuals/                # 产品说明书
│   ├── anker-737-manual.md
│   └── soundcore-liberty4-manual.md
├── faqs/                   # FAQ
│   └── common-questions.md
└── corpus/                 # 差评语料（块1.2）
    └── reviews-30to50.md
```

## 入库流程（块2.4 完成标准）

1. **准备**：把素材放到对应目录
2. **格式**：每篇 markdown 文件用清晰的条款编号 / 章节标题 / Q&A 分隔
3. **入库脚本**（待补）：
   ```bash
   cd retrieval
   python scripts/ingest.py --source ../knowledge_base/
   ```
   脚本会读取 → 切片 → 向量化 → 加入索引
4. **测试**：跑 20 个真实问法验证召回

## 切片提示

- **政策文档**：必须用「第N条」格式，否则切片器识别不出
- **说明书**：必须用 `## 二级标题` 分章节
- **FAQ**：必须用 `Q: ...\nA: ...` 格式
- **差评语料**：作为意图分类器的 few-shot 例句使用，不入向量库

## 素材来源（待办）

- [ ] Anker 官网保修政策页（队长块1.1）
- [ ] Soundcore 官网保修政策页
- [ ] eufy 官网保修政策页
- [ ] Anker 737 说明书 PDF
- [ ] Soundcore Liberty 4 说明书
- [ ] 电商差评 30-50 条（队长块1.2）