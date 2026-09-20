"""
policy_retrieve 路由 - 代理到 retrieval 服务
让 mock_apis 统一暴露 policy_retrieve 工具
"""
import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

router = APIRouter()

# retrieval 服务地址
RETRIEVAL_URL = os.getenv("RETRIEVAL_URL", "http://localhost:8001")


class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500, description="用户问题或检索关键词")
    top_k: int = Field(default=5, ge=1, le=20, description="返回前 K 条结果")
    filters: Optional[Dict[str, Any]] = Field(default=None, description="元数据过滤：product/region/channel")


@router.post("/api/policy/retrieve")
async def policy_retrieve(req: RetrieveRequest):
    """
    政策检索 - 调自建 retrieval 服务
    返回 top-K 相关条款 + 整体置信度 + answerable 标志
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            r = await client.post(
                f"{RETRIEVAL_URL}/retrieve",
                json=req.model_dump(exclude_none=True),
            )
            r.raise_for_status()
            return r.json()
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail=f"retrieval 服务不可达：{RETRIEVAL_URL}，请先启动 retrieval/app.py",
            )
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)