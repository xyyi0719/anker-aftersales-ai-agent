"""
查保修 API
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/warranty", tags=["warranty"])


class WarrantyCheckRequest(BaseModel):
    order_id: Optional[str] = None
    product_model: str = Field(..., description="产品型号")
    purchase_date: str = Field(..., description="购买日期 YYYY-MM-DD")
    region: Optional[str] = "CN"


# 不同产品的保修期（个月）
WARRANTY_PERIODS = {
    "Anker 737": 18,
    "Anker 335": 18,
    "Anker 525": 18,
    "Soundcore Liberty 4": 12,
    "Soundcore Life P3": 12,
    "eufy RoboVac 11S": 12,
    "eufy S1 Pro": 12,  # 注意歧义：吸奶器 vs 扫地机器人
}


@router.post("/check")
async def check_warranty(req: WarrantyCheckRequest):
    """查保修状态"""
    
    # 产品歧义检测：S1 Pro 有歧义（吸奶器 / 扫地机器人）
    if req.product_model in ["S1 Pro", "s1 pro", "S1PRO"]:
        # 触发消歧流程
        return {
            "in_warranty": False,
            "ambiguous": True,
            "candidates": [
                {
                    "product_model": "eufy S1 Pro",
                    "product_category": "robot_vacuum",
                    "warranty_period_months": 12
                },
                {
                    "product_model": "Anker S1 Pro (婴儿吸奶器)",
                    "product_category": "breast_pump",
                    "warranty_period_months": 12
                }
            ],
            "message": "检测到产品型号存在歧义。请用户澄清是哪个产品。",
            "error": "PRODUCT_AMBIGUOUS"
        }
    
    # 产品型号无效
    if req.product_model not in WARRANTY_PERIODS:
        return {
            "in_warranty": False,
            "error": "INVALID_PRODUCT_MODEL",
            "message": f"未知的产品型号: {req.product_model}",
            "fallback_action": "trigger_product_lookup"
        }
    
    # 计算保修状态
    try:
        purchase = datetime.strptime(req.purchase_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_DATE", "message": "购买日期格式错误，应为 YYYY-MM-DD"}
        )
    
    warranty_months = WARRANTY_PERIODS[req.product_model]
    warranty_end = purchase + timedelta(days=warranty_months * 30)
    
    now = datetime.now()
    in_warranty = now <= warranty_end
    days_remaining = max((warranty_end - now).days, 0)
    
    # 临期检测（30天内到期）
    expiring_soon = in_warranty and days_remaining <= 30
    
    result = {
        "in_warranty": in_warranty,
        "warranty_expires": warranty_end.strftime("%Y-%m-%d"),
        "days_remaining": days_remaining,
        "warranty_type": f"standard_{warranty_months}m",
        "exclusions_applied": [],
        "expiring_soon": expiring_soon,
    }
    
    if not in_warranty:
        result["out_of_warranty_solutions"] = [
            "付费维修（费用以检测结果为准）",
            "以旧换新（部分产品支持）"
        ]
    
    return result