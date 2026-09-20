"""Read-only, automatically initialized offline retrieval service."""
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Optional
from retrieval.lexical import retriever

app = FastAPI(title='Anker 离线 FAQ 检索', version='1.1.0')
class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=8000)
    top_k: int = Field(default=3, ge=1, le=10)
    filters: Optional[dict[str,str]] = None

@app.get('/healthz')
def health():
    return dict(status='ok', chunks_loaded=len(retriever.chunks), index_ready=bool(retriever.chunks), embedding_required=False)

@app.post('/retrieve')
def retrieve(req: RetrieveRequest):
    return retriever.search(req.query, req.top_k, req.filters)
