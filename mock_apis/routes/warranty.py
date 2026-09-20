from fastapi import APIRouter
from pydantic import BaseModel, Field
from mock_apis.domain import warranty
router = APIRouter(prefix='/api/warranty', tags=['warranty'])
class WarrantyRequest(BaseModel):
    order_id: str = Field(min_length=1, max_length=100)
@router.post('/check')
def check(req: WarrantyRequest):
    # Ignore caller-supplied dates/models: authoritative data is the mock order record.
    return warranty(req.order_id)
