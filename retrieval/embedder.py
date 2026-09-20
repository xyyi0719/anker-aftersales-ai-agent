"""
Embedding 客户端
- 调用 M3 embedding API
- 批量向量化
- 降级：API 不可用时使用简易 TF-IDF 向量化（仅用于 demo，保证可跑通）
"""
import os
import hashlib
import httpx
import re
from typing import List
import numpy as np

import config


def _hash_embed(text: str, dim: int = 384) -> np.ndarray:
    """简易 hash-based embedding（仅用于 API 不可用时的降级）
    - 字符 n-gram 哈希到 dim 维
    - L2 归一化
    - 保留语义近似性（重复词会有相似向量）
    """
    v = np.zeros(dim, dtype=np.float32)
    text = text.lower()
    # 字符 trigram
    for i in range(len(text) - 2):
        trigram = text[i:i+3]
        h = int(hashlib.md5(trigram.encode('utf-8')).hexdigest(), 16)
        idx = h % dim
        v[idx] += 1.0
    # 词 unigram
    for word in re.findall(r'\w+', text):
        h = int(hashlib.md5(word.encode('utf-8')).hexdigest(), 16)
        idx = h % dim
        v[idx] += 2.0
    # L2 归一化
    norm = np.linalg.norm(v)
    if norm > 0:
        v = v / norm
    return v


class M3Embedder:
    def __init__(self):
        self.base = config.M3_API_BASE
        self.key = config.M3_API_KEY
        self.model = config.M3_EMBED_MODEL
        self.dim = 384
        self._degraded = False  # 降级标志
    
    async def embed(self, texts: List[str]) -> np.ndarray:
        """批量向量化（API 失败自动降级到 hash embedding）"""
        if not texts:
            return np.zeros((0, self.dim), dtype=np.float32)
        
        if not self.key or self._degraded:
            return np.array([_hash_embed(t, self.dim) for t in texts], dtype=np.float32)
        
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{self.base}/embeddings",
                    headers={"Authorization": f"Bearer {self.key}"},
                    json={"model": self.model, "input": texts}
                )
                resp.raise_for_status()
                data = resp.json()
            
            vectors = [d['embedding'] for d in data['data']]
            arr = np.array(vectors, dtype=np.float32)
            # 记录真实维度供后续用
            if arr.shape[1] != self.dim:
                self.dim = arr.shape[1]
            return arr
        except Exception as e:
            print(f"[embedder] API 失败，降级到 hash embedding: {e}")
            self._degraded = True
            return np.array([_hash_embed(t, self.dim) for t in texts], dtype=np.float32)
    
    async def embed_one(self, text: str) -> np.ndarray:
        """单条向量化"""
        return (await self.embed([text]))[0]


# 全局实例
embedder = M3Embedder()