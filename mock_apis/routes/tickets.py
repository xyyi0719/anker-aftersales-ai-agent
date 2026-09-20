"""
创建工单 API
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import random
import string

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


class CreateTicketRequest(BaseModel):
    order_id: Optional[str] = None
    product_model: str
    fault_type: str = Field(..., description="故障类型，如鼓包/不进电/无声音")
    fault_description: str = Field(..., min_length=5)
    images: List[str] = Field(default_factory=list)
    user_contact: str = Field(..., description="用户联系方式")
    emotion_level: Optional[str] = "normal"  # normal / upset / angry / complaint


# 工单存储（内存）
TICKETS_DB = []


@router.post("")
async def create_ticket(req: CreateTicketRequest):
    """创建工单"""
    
    # 校验
    if not req.fault_description or len(req.fault_description) < 5:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_DESCRIPTION", "message": "故障描述过短"}
        )
    
    # 生成工单号
    ticket_id = "TKT-" + datetime.now().strftime("%Y%m%d") + "-" + ''.join(
        random.choices(string.digits, k=4)
    )
    
    # 估算解决时间（情绪等级影响 SLA）
    sla_days = {
        "normal": 3,
        "upset": 2,
        "angry": 1,
        "complaint": 1,  # 投诉风险最高优先级
    }.get(req.emotion_level, 3)
    
    estimated_resolution = (datetime.now() + timedelta(days=sla_days)).strftime("%Y-%m-%d")
    
    ticket = {
        "ticket_id": ticket_id,
        "order_id": req.order_id,
        "product_model": req.product_model,
        "fault_type": req.fault_type,
        "fault_description": req.fault_description,
        "images": req.images,
        "user_contact": req.user_contact,
        "emotion_level": req.emotion_level,
        "status": "created",
        "created_at": datetime.now().isoformat(),
        "estimated_resolution": estimated_resolution,
        "sla_days": sla_days,
        "next_step": f"客服将在 {sla_days * 24} 小时内联系您安排 {'退换' if req.emotion_level in ['angry', 'complaint'] else '维修'}",
    }
    
    TICKETS_DB.append(ticket)
    
    return ticket


@router.get("")
async def list_tickets():
    """列出所有工单（调试用）"""
    return {"count": len(TICKETS_DB), "tickets": TICKETS_DB}


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str):
    """查工单"""
    for t in TICKETS_DB:
        if t['ticket_id'] == ticket_id:
            return t
    
    raise HTTPException(
        status_code=404,
        detail={"error": "TICKET_NOT_FOUND", "message": "工单不存在"}
    )