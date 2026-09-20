"""
检索服务 FastAPI 应用
- POST /retrieve 主入口
- POST /index 索引文档（一次性）
- GET /healthz 健康检查
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
import asyncio

from retriever import retriever
import config


# ---------- Schema ----------

class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(default=5, ge=1, le=20)
    filters: Optional[Dict[str, Any]] = None


class RetrieveResponse(BaseModel):
    results: List[Dict[str, Any]]
    confidence: float
    answerable: bool
    low_confidence_reason: Optional[str]
    fallback_message: Optional[str]


class IndexRequest(BaseModel):
    documents: List[Dict[str, Any]] = Field(
        ...,
        description="每条 {text, metadata, type='policy'|'manual'|'faq'}"
    )


class HealthResponse(BaseModel):
    status: str
    chunks_loaded: int
    index_ready: bool


# ---------- 生命周期 ----------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时尝试加载索引"""
    try:
        retriever.load()
        print(f"✓ Index loaded with {len(retriever.chunks)} chunks")
    except FileNotFoundError:
        print("⚠ No existing index. Use POST /index to build one.")
    
    yield
    
    # 关闭时保存
    if retriever.chunks:
        retriever.save()


app = FastAPI(
    title="Anker 售后检索服务",
    description="条款切片 + 混合检索 + 置信度返回",
    version="1.0.0",
    lifespan=lifespan,
)


# ---------- 接口 ----------

@app.get("/healthz", response_model=HealthResponse)
async def healthz():
    return HealthResponse(
        status="ok",
        chunks_loaded=len(retriever.chunks),
        index_ready=retriever.vector_index is not None,
    )


@app.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest):
    """主检索接口"""
    try:
        result = await retriever.retrieve(
            query=req.query,
            top_k=req.top_k,
            filters=req.filters,
        )
        return RetrieveResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/index")
async def index_docs(req: IndexRequest):
    """索引文档（一次性）"""
    try:
        retriever.add_documents(req.documents)
        await retriever.build_index()
        retriever.save()
        return {
            "status": "ok",
            "total_chunks": len(retriever.chunks),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- 启动 ----------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host=config.RETRIEVAL_HOST,
        port=config.RETRIEVAL_PORT,
        reload=True,
    )