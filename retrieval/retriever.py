"""
混合检索器
- BM25（关键词，jieba 分词）
- FAISS 向量（语义）
- RRF 融合
- 置信度计算
"""
import json
import pickle
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
import faiss
from rank_bm25 import BM25Okapi
import jieba

import config
from embedder import embedder
from chunker import chunk_policy, chunk_manual, chunk_faq


class HybridRetriever:
    def __init__(self, index_dir: Path = None):
        self.index_dir = index_dir or config.INDEX_DIR
        self.index_dir.mkdir(parents=True, exist_ok=True)
        
        self.chunks: List[Dict[str, Any]] = []
        self.bm25: Optional[BM25Okapi] = None
        self.vector_index: Optional[faiss.IndexFlatIP] = None
        self.embeddings: Optional[np.ndarray] = None
    
    # ---------- 索引构建 ----------
    
    def add_documents(self, docs: List[Dict[str, Any]]):
        """
        添加文档到索引。
        
        每条 doc 格式：
        {
            "text": "...",
            "metadata": {"product": "...", "region": "...", "source": "..."},
            "type": "policy" | "manual" | "faq"  # 决定切片策略
        }
        """
        new_chunks = []
        for doc in docs:
            doc_type = doc.get('type', 'policy')
            metadata = doc.get('metadata', {})
            
            if doc_type == 'policy':
                chunks = chunk_policy(doc['text'], metadata)
            elif doc_type == 'manual':
                chunks = chunk_manual(doc['text'], metadata)
            elif doc_type == 'faq':
                chunks = chunk_faq(doc['text'], metadata)
            else:
                chunks = [{
                    'chunk_id': f"raw-{len(self.chunks)}",
                    'text': doc['text'],
                    'metadata': metadata
                }]
            
            new_chunks.extend(chunks)
        
        self.chunks.extend(new_chunks)
        print(f"Added {len(new_chunks)} chunks. Total: {len(self.chunks)}")
    
    async def build_index(self):
        """构建 BM25 + 向量索引"""
        if not self.chunks:
            raise ValueError("No chunks. Call add_documents first.")
        
        # BM25（中文 jieba 分词）
        tokenized_corpus = []
        for chunk in self.chunks:
            tokens = list(jieba.cut_for_search(chunk['text']))
            tokenized_corpus.append(tokens)
        
        self.bm25 = BM25Okapi(tokenized_corpus)
        
        # 向量索引
        texts = [c['text'] for c in self.chunks]
        self.embeddings = await embedder.embed(texts)
        
        # L2 归一化（便于内积 = 余弦相似度）
        faiss.normalize_L2(self.embeddings)
        
        self.vector_index = faiss.IndexFlatIP(self.embeddings.shape[1])
        self.vector_index.add(self.embeddings)
        
        print(f"Index built: {len(self.chunks)} chunks, dim={self.embeddings.shape[1]}")
    
    def save(self):
        """持久化索引"""
        with open(self.index_dir / "chunks.pkl", "wb") as f:
            pickle.dump(self.chunks, f)
        
        if self.bm25 is not None:
            with open(self.index_dir / "bm25.pkl", "wb") as f:
                pickle.dump(self.bm25, f)
        
        if self.vector_index is not None and self.embeddings is not None:
            faiss.write_index(self.vector_index, str(self.index_dir / "vectors.faiss"))
            np.save(self.index_dir / "embeddings.npy", self.embeddings)
        
        print(f"Index saved to {self.index_dir}")
    
    def load(self):
        """加载索引"""
        with open(self.index_dir / "chunks.pkl", "rb") as f:
            self.chunks = pickle.load(f)
        
        with open(self.index_dir / "bm25.pkl", "rb") as f:
            self.bm25 = pickle.load(f)
        
        if (self.index_dir / "vectors.faiss").exists():
            self.vector_index = faiss.read_index(str(self.index_dir / "vectors.faiss"))
            self.embeddings = np.load(self.index_dir / "embeddings.npy")
        
        print(f"Index loaded: {len(self.chunks)} chunks")
    
    # ---------- 检索 ----------
    
    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        filters: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        混合检索 + 置信度。
        
        返回：
        {
            "results": [...],
            "confidence": 0-1,
            "answerable": bool,
            "low_confidence_reason": str | None
        }
        """
        if self.bm25 is None or self.vector_index is None:
            raise ValueError("Index not built. Call build_index first.")
        
        # 1. 过滤
        candidates = self._filter(filters)
        if not candidates:
            return self._no_result("no_candidate_after_filter")
        
        candidate_idx = [i for i, c in enumerate(self.chunks) if c in candidates]
        
        # 2. BM25
        query_tokens = list(jieba.cut_for_search(query))
        bm25_scores_all = self.bm25.get_scores(query_tokens)
        bm25_scores = bm25_scores_all[candidate_idx]
        
        # 归一化到 0-1
        bm25_norm = self._normalize(bm25_scores)
        
        # 3. 向量
        query_emb = await embedder.embed_one(query)
        query_emb = query_emb.reshape(1, -1).astype(np.float32)
        faiss.normalize_L2(query_emb)
        
        # 在全索引上检索，取 candidates 的子集
        k_search = min(top_k * 5, len(self.chunks))
        vector_scores_all, vector_idx_all = self.vector_index.search(query_emb, k_search)
        vector_scores_all = vector_scores_all[0]
        vector_idx_all = vector_idx_all[0]
        
        # 把向量分数映射回 candidate
        vector_score_map = {idx: score for idx, score in zip(vector_idx_all, vector_scores_all)}
        vector_scores = np.array([vector_score_map.get(i, 0.0) for i in candidate_idx])
        vector_norm = self._normalize(vector_scores)
        
        # 4. 融合（加权求和）
        combined = (
            config.HYBRID_BM25_WEIGHT * bm25_norm +
            config.HYBRID_VECTOR_WEIGHT * vector_norm
        )
        
        # 5. 排序
        top_indices = np.argsort(combined)[::-1][:top_k]
        
        results = []
        for idx in top_indices:
            actual_idx = candidate_idx[idx]
            chunk = self.chunks[actual_idx]
            results.append({
                "chunk_id": chunk['chunk_id'],
                "text": chunk['text'],
                "metadata": chunk['metadata'],
                "score": float(combined[idx]),
                "bm25_score": float(bm25_norm[idx]),
                "vector_score": float(vector_norm[idx]),
            })
        
        # 6. 置信度
        top1_score = results[0]['score'] if results else 0.0
        avg_top3 = float(np.mean([r['score'] for r in results[:3]])) if len(results) >= 3 else top1_score
        
        # 综合置信度 = top1 + avg_top3 的平均
        confidence = (top1_score + avg_top3) / 2
        
        answerable = (
            confidence >= config.CONFIDENCE_THRESHOLD and
            top1_score >= config.TOP1_MIN_SCORE
        )
        
        low_conf_reason = None
        if not answerable:
            if top1_score < config.TOP1_MIN_SCORE:
                low_conf_reason = "top1_too_low"
            else:
                low_conf_reason = "overall_low_confidence"
        
        return {
            "results": results,
            "confidence": round(confidence, 4),
            "answerable": answerable,
            "low_confidence_reason": low_conf_reason,
            "fallback_message": (
                "抱歉，未找到可靠的政策条款。建议提供更多细节，或转人工核实。"
                if not answerable else None
            ),
        }
    
    def _filter(self, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """按 metadata 过滤"""
        if not filters:
            return self.chunks
        
        filtered = []
        for chunk in self.chunks:
            meta = chunk.get('metadata', {})
            ok = True
            for k, v in filters.items():
                if meta.get(k) != v:
                    ok = False
                    break
            if ok:
                filtered.append(chunk)
        
        return filtered
    
    def _normalize(self, scores: np.ndarray) -> np.ndarray:
        """Min-Max 归一化到 0-1"""
        if len(scores) == 0:
            return scores
        
        s_min, s_max = scores.min(), scores.max()
        if s_max - s_min < 1e-9:
            return np.ones_like(scores)
        
        return (scores - s_min) / (s_max - s_min)
    
    def _no_result(self, reason: str) -> Dict[str, Any]:
        return {
            "results": [],
            "confidence": 0.0,
            "answerable": False,
            "low_confidence_reason": reason,
            "fallback_message": "抱歉，未找到相关信息。"
        }


# 全局实例
retriever = HybridRetriever()