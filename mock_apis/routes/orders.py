"""
查订单 API
"""
from fastapi import APIRouter, HTTPException, Path as PathParam
from pydantic import BaseModel, Field
from typing import Optional
import json
from pathlib import Path

router = APIRouter(prefix="/api/orders", tags=["orders"])

# 加载 Mock 订单数据
DATA_FILE = Path(__file__).parent.parent / "data" / "orders.json"
ORDERS_DB = {}
if DATA_FILE.exists():
    with open(DATA_FILE, encoding='utf-8') as f:
        orders_list = json.load(f)
        for o in orders_list:
            ORDERS_DB[o['order_id']] = o


class OrderQuery(BaseModel):
    region: Optional[str] = None
    channel: Optional[str] = None


@router.get("/{order_id}")
async def get_order(
    order_id: str = PathParam(..., description="订单号"),
    region: Optional[str] = None,
    channel: Optional[str] = None,
):
    """
    查订单详情。
    
    注意：这是 POST 路径但 GET 也可调，方便 Dify 工具配置。
    实际 Dify 中通常用 POST + body 传 region/channel。
    """
    # 格式校验
    if not order_id or len(order_id) < 5:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_ORDER_ID", "message": "订单号格式错误"}
        )
    
    # 查找
    order = ORDERS_DB.get(order_id)
    
    if not order:
        # 触发「经销商订单查无」场景：返回特殊错误码
        raise HTTPException(
            status_code=404,
            detail={
                "error": "ORDER_NOT_FOUND",
                "message": "未在官方系统中找到此订单。请问您是否通过经销商或其他渠道购买？",
                "fallback_action": "trigger_dealer_lookup",
            }
        )
    
    # 过滤校验
    if region and order.get('region') != region:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "ORDER_REGION_MISMATCH",
                "message": f"订单区域不匹配（订单在 {order.get('region')}）",
            }
        )
    
    return order


@router.post("/{order_id}")
async def get_order_post(
    order_id: str,
    query: OrderQuery = OrderQuery(),
):
    """POST 版本（Dify OpenAPI 工具更常用）"""
    return await get_order(order_id, query.region, query.channel)