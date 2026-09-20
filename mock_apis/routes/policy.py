import os
import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field
from mock_apis.domain import policy_evidence
from retrieval.lexical import POLICY, retriever
router = APIRouter()
class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1,max_length=8000)
    top_k: int = Field(default=3,ge=1,le=10)
    filters: dict[str,str] = Field(default_factory=dict)
    order_id: str = ''

def retrieve_data(data):
    req = RetrieveRequest(**data)
    if POLICY.search(req.query): return policy_evidence(req.query,req.order_id)
    url = os.environ.get('RETRIEVAL_URL')
    if not url: return retriever.search(req.query,req.top_k,req.filters)
    try:
        response = httpx.post(url.rstrip('/')+'/retrieve',json=req.model_dump(exclude={'order_id'}),timeout=8)
        response.raise_for_status()
        result = response.json()
        if not isinstance(result,dict) or type(result.get('answerable')) is not bool or not isinstance(result.get('results'),list):
            raise ValueError('invalid retrieval response')
        return result
    except (httpx.HTTPError,ValueError):
        return dict(mock=True,answerable=False,confidence=0.0,results=[],low_confidence_reason='retrieval_unavailable')
@router.post('/api/policy/retrieve')
def retrieve(req: RetrieveRequest):
    return retrieve_data(req.model_dump())
