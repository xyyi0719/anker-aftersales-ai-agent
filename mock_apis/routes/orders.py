from fastapi import APIRouter
from mock_apis.domain import order_lookup
router = APIRouter(prefix='/api/orders', tags=['orders'])
@router.get('/{order_id}')
@router.post('/{order_id}')
def get_order(order_id: str):
    return order_lookup(order_id)
