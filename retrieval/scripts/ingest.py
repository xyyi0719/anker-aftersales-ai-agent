"""
知识库入库脚本
- 读取 knowledge_base/ 下所有 markdown 文件
- 按类型切片
- 通过 HTTP POST 到检索服务的 /index 端点

用法：
    python ingest.py --source ../../knowledge_base --retrieval-url http://localhost:8001
"""
import argparse
import httpx
import json
import re
from pathlib import Path


def detect_doc_type(path: Path, content: str) -> str:
    """根据路径和内容判断文档类型"""
    p = str(path).lower()
    
    if 'policies/' in p or 'policy' in p or 'warranty' in p:
        return 'policy'
    if 'manuals/' in p or 'manual' in p:
        return 'manual'
    if 'faqs/' in p or 'faq' in p:
        return 'faq'
    
    # 基于内容判断
    if 'Q:' in content and 'A:' in content:
        return 'faq'
    if '第' in content and '条' in content:
        return 'policy'
    
    return 'manual'  # 默认


def extract_metadata(path: Path, content: str) -> dict:
    """从路径和内容提取元数据"""
    metadata = {
        'source': path.stem,
        'filename': path.name,
        'filepath': str(path),
    }
    
    # 产品识别
    product_patterns = [
        ('Anker 737', 'Anker 737', 'power_bank'),
        ('Anker 335', 'Anker 335', 'power_bank'),
        ('Anker 525', 'Anker 525', 'power_bank'),
        ('Soundcore Liberty 4', 'Soundcore Liberty 4', 'earbuds'),
        ('Soundcore Life P3', 'Soundcore Life P3', 'earbuds'),
        ('eufy RoboVac', 'eufy RoboVac', 'robot_vacuum'),
        ('eufy S1 Pro', 'eufy S1 Pro', 'robot_vacuum'),
    ]
    
    for pattern, model, category in product_patterns:
        if pattern in content:
            metadata['product'] = model
            metadata['product_category'] = category
            break
    
    # 区域识别
    if 'CN' in content or '中国大陆' in content or '中国' in content:
        metadata['region'] = 'CN'
    elif 'US' in content or '美国' in content:
        metadata['region'] = 'US'
    elif 'EU' in content or '欧洲' in content:
        metadata['region'] = 'EU'
    elif 'JP' in content or '日本' in content:
        metadata['region'] = 'JP'
    
    return metadata


def read_documents(source_dir: Path) -> list:
    """递归读取所有 markdown 文件"""
    docs = []
    
    for path in source_dir.rglob('*.md'):
        with open(path, encoding='utf-8') as f:
            content = f.read()
        
        # 跳过 README
        if path.name == 'README.md':
            continue
        
        # 跳过空文件
        if len(content.strip()) < 50:
            print(f"⏭ 跳过（内容过短）: {path}")
            continue
        
        doc_type = detect_doc_type(path, content)
        metadata = extract_metadata(path, content)
        
        docs.append({
            'type': doc_type,
            'metadata': metadata,
            'text': content,
        })
        
        print(f"✓ {path.name} → {doc_type} ({len(content)} chars)")
    
    return docs


def post_to_retrieval(retrieval_url: str, documents: list) -> dict:
    """POST 到检索服务的 /index 端点"""
    url = f"{retrieval_url.rstrip('/')}/index"
    
    print(f"\n→ POST {url}")
    print(f"  文档数: {len(documents)}")
    
    resp = httpx.post(url, json={'documents': documents}, timeout=300)
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser(description='知识库入库脚本')
    parser.add_argument(
        '--source',
        default='../../knowledge_base',
        help='素材目录路径'
    )
    parser.add_argument(
        '--retrieval-url',
        default='http://localhost:8001',
        help='检索服务地址'
    )
    parser.add_argument(
        '--output',
        help='可选：保存文档 JSON 到本地'
    )
    
    args = parser.parse_args()
    
    source_dir = Path(args.source)
    if not source_dir.exists():
        print(f"❌ 目录不存在: {source_dir}")
        return
    
    print(f"📁 读取: {source_dir}")
    documents = read_documents(source_dir)
    
    if not documents:
        print("⚠ 未找到文档，请检查 --source 路径")
        return
    
    # 可选：保存到本地
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump({'documents': documents}, f, ensure_ascii=False, indent=2)
        print(f"💾 已保存: {args.output}")
    
    # POST 到检索服务
    try:
        result = post_to_retrieval(args.retrieval_url, documents)
        print(f"\n✅ 入库成功: {result}")
    except httpx.HTTPError as e:
        print(f"\n❌ 入库失败: {e}")
        print("   请确认检索服务已启动（python app.py）")


if __name__ == '__main__':
    main()