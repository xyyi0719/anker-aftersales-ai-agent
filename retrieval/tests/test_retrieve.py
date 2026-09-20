"""
检索服务测试
- 切片正确性
- BM25 + 向量召回
- 置信度阈值
"""
import pytest
import asyncio
from retriever import HybridRetriever
from chunker import chunk_policy, chunk_manual, chunk_faq


# ---------- 切片测试 ----------

def test_chunk_policy_basic():
    text = """
第1条 保修期为 18 个月。

第2条 人为损坏不在保修范围内，包括跌落、挤压、进水。

第3条 充电宝鼓包应立即停止使用。
"""
    chunks = chunk_policy(text, metadata={'source': 'test'})
    assert len(chunks) == 3
    assert chunks[0]['metadata']['article'] == '第1条'
    assert '18 个月' in chunks[0]['text']


def test_chunk_policy_handles_articles():
    text = """
Article 1: This is the first article.

Article 2: This is the second article with more content. It talks about warranty and other things related to the product.
"""
    chunks = chunk_policy(text, metadata={'source': 'test'})
    assert len(chunks) >= 2
    assert any('Article 1' in c['metadata'].get('article', '') for c in chunks)


def test_chunk_manual():
    text = """
# 产品介绍
这是产品介绍内容...

## 充电方式
请使用原装充电线...

## 故障排查
如果设备无法开机...
"""
    chunks = chunk_manual(text, metadata={'source': 'manual'})
    assert len(chunks) >= 1
    assert any('section' in c['metadata'] for c in chunks)


def test_chunk_faq():
    text = """
Q: 保修期多久？
A: 18 个月。

Q: 鼓包了怎么办？
A: 立即停止使用，联系客服。
"""
    chunks = chunk_faq(text, metadata={'source': 'faq'})
    assert len(chunks) == 2
    assert '保修期多久' in chunks[0]['metadata']['question']


# ---------- 检索测试（需要 M3 API） ----------

@pytest.mark.asyncio
async def test_retrieve_smoke():
    """冒烟测试：需要先索引"""
    retriever = HybridRetriever(index_dir="./data/test_index")
    
    docs = [{
        'type': 'policy',
        'metadata': {'source': 'test', 'product': 'Anker 737', 'region': 'CN'},
        'text': """
第1条 充电宝鼓包应立即停止使用，避免继续充电。
第2条 保修期 18 个月。
第3条 进水不在保修范围内。
"""
    }]
    
    retriever.add_documents(docs)
    await retriever.build_index()
    
    result = await retriever.retrieve("充电宝鼓包怎么办")
    
    assert 'results' in result
    assert 'confidence' in result
    assert 'answerable' in result
    
    if result['answerable']:
        assert len(result['results']) > 0
        assert any('鼓包' in r['text'] for r in result['results'])
    
    # 清理
    import shutil
    shutil.rmtree("./data/test_index", ignore_errors=True)


@pytest.mark.asyncio
async def test_retrieve_low_confidence():
    """低置信度应返回无可靠结果"""
    retriever = HybridRetriever(index_dir="./data/test_index")
    
    docs = [{
        'type': 'policy',
        'metadata': {'source': 'test', 'product': 'Anker 737', 'region': 'CN'},
        'text': "第1条 充电宝鼓包应立即停止使用。"
    }]
    
    retriever.add_documents(docs)
    await retriever.build_index()
    
    # 问一个完全无关的问题
    result = await retriever.retrieve("今天天气怎么样")
    
    assert result['answerable'] is False
    assert result['low_confidence_reason'] is not None
    
    import shutil
    shutil.rmtree("./data/test_index", ignore_errors=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])