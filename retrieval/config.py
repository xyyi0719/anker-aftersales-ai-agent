"""配置加载"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# M3 Embedding
M3_API_BASE = os.getenv("M3_API_BASE", "https://api.MiniMax.com/v1")
M3_API_KEY = os.getenv("M3_API_KEY", "")
M3_EMBED_MODEL = os.getenv("M3_EMBED_MODEL", "MiniMax-embed-01")

# 服务
RETRIEVAL_HOST = os.getenv("RETRIEVAL_HOST", "0.0.0.0")
RETRIEVAL_PORT = int(os.getenv("RETRIEVAL_PORT", "8001"))

# 索引
INDEX_DIR = Path(os.getenv("INDEX_DIR", "./data/index"))
INDEX_DIR.mkdir(parents=True, exist_ok=True)

# 置信度
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))
TOP1_MIN_SCORE = float(os.getenv("TOP1_MIN_SCORE", "0.4"))
HYBRID_BM25_WEIGHT = float(os.getenv("HYBRID_BM25_WEIGHT", "0.5"))
HYBRID_VECTOR_WEIGHT = float(os.getenv("HYBRID_VECTOR_WEIGHT", "0.5"))

# 切片
CHUNK_MIN_LEN = int(os.getenv("CHUNK_MIN_LEN", "100"))
CHUNK_MAX_LEN = int(os.getenv("CHUNK_MAX_LEN", "800"))