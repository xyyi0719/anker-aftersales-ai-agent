"""
条款边界切片器
- 政策文档：按「第N条」/「Article N」/「## N.」切分
- 说明书：按章节切分
- FAQ：按问答对切分
"""
import re
from typing import List, Dict, Any
from config import CHUNK_MIN_LEN, CHUNK_MAX_LEN


def chunk_policy(text: str, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """
    按条款边界切片政策文档。
    
    支持的分隔符：
    - 第X条 / 第X章
    - Article N / Section N
    - ## N. / ### N.
    """
    metadata = metadata or {}
    
    # 匹配条款起点的正则
    patterns = [
        r'(?=第[一二三四五六七八九十百零\d]+条)',
        r'(?=第[一二三四五六七八九十百零\d]+章)',
        r'(?=(?:Article|Section)\s+\d+)',
        r'(?=##\s*\d+\.)',
        r'(?=###\s*\d+\.)',
    ]
    combined = '|'.join(patterns)
    
    # 切分
    parts = re.split(combined, text)
    
    chunks = []
    for i, part in enumerate(parts):
        part = part.strip()
        if len(part) < CHUNK_MIN_LEN:
            continue
        
        # 提取条款号
        article_match = re.match(
            r'((?:第[一二三四五六七八九十百零\d]+条|第[一二三四五六七八九十百零\d]+章|(?:Article|Section)\s+\d+|##\s*\d+\.|###\s*\d+\.)[^。\n]*?)',
            part
        )
        article_id = article_match.group(1).strip() if article_match else f"clause-{i}"
        
        # 超长则二次切分（按段落）
        if len(part) > CHUNK_MAX_LEN:
            sub_chunks = _split_by_paragraph(part, metadata)
            for j, sub in enumerate(sub_chunks):
                sub['chunk_id'] = f"{metadata.get('source', 'policy')}-{article_id}-p{j}"
                sub['metadata'] = {**metadata, 'article': article_id, 'part': j}
                chunks.append(sub)
        else:
            chunks.append({
                'chunk_id': f"{metadata.get('source', 'policy')}-{article_id}",
                'text': part,
                'metadata': {**metadata, 'article': article_id}
            })
    
    return chunks


def chunk_manual(text: str, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """按章节切片说明书"""
    metadata = metadata or {}
    
    # 按二级标题切分
    parts = re.split(r'(?=##\s+[^\n]+)', text)
    
    chunks = []
    for i, part in enumerate(parts):
        part = part.strip()
        if len(part) < CHUNK_MIN_LEN:
            continue
        
        # 提取章节标题
        title_match = re.match(r'##\s+([^\n]+)', part)
        title = title_match.group(1).strip() if title_match else f"section-{i}"
        
        chunks.append({
            'chunk_id': f"{metadata.get('source', 'manual')}-{title}",
            'text': part,
            'metadata': {**metadata, 'section': title}
        })
    
    return chunks


def chunk_faq(text: str, metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """按问答对切片 FAQ"""
    metadata = metadata or {}
    
    # 假设 FAQ 格式："Q: ...\nA: ..."
    pairs = re.split(r'\n(?=Q[:：])', text)
    
    chunks = []
    for i, pair in enumerate(pairs):
        pair = pair.strip()
        if not pair:
            continue
        
        # 提取问题
        q_match = re.match(r'Q[:：]\s*([^\n]+)', pair)
        q = q_match.group(1).strip() if q_match else f"faq-{i}"
        
        chunks.append({
            'chunk_id': f"{metadata.get('source', 'faq')}-{i}",
            'text': pair,
            'metadata': {**metadata, 'question': q}
        })
    
    return chunks


def _split_by_paragraph(text: str, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
    """按段落二次切分超长 chunk"""
    paragraphs = re.split(r'\n\s*\n', text)
    
    result = []
    buffer = ""
    for p in paragraphs:
        if len(buffer) + len(p) > CHUNK_MAX_LEN and buffer:
            result.append({'text': buffer.strip()})
            buffer = p
        else:
            buffer += "\n\n" + p if buffer else p
    
    if buffer:
        result.append({'text': buffer.strip()})
    
    return result


# 命令行调用
if __name__ == "__main__":
    sample = """
第1条 本政策适用于通过 Anker 官方渠道购买的充电类产品。

第2条 保修期为自购买之日起 18 个月内。期间出现非人为损坏的性能故障，可免费维修或更换。

第3条 充电宝出现鼓包、漏液、异味等异常时，应立即停止使用并联系客服。请勿自行拆解或继续充电，以免引发安全事故。

第4条 以下情况不属于保修范围：
（1）人为损坏，包括跌落、挤压、进水等；
（2）私自拆机或改装；
（3）不可抗力造成的损坏。
"""
    
    chunks = chunk_policy(sample, metadata={'source': 'anker-737-policy', 'product': 'Anker 737', 'region': 'CN'})
    for c in chunks:
        print(f"--- {c['chunk_id']} ---")
        print(c['text'][:80])
        print()