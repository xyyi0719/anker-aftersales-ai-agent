"""
查订单 API
"""
from fastapi import APIRouter, HTTPException, Path as PathParam
from pydantic import BaseModel, Field
from typing import Optional
import json
from pathlib import Path


def _normalize_channel(channel: str) -> str:
    """渠道字段归一化: 把 mock 数据的 channel 值映射到 policy_routing 的 match.channel"""
    mapping = {
        'official': 'official_site',
        'jd': 'tmall_jd',
        'tmall': 'tmall_jd',
        'douyin': 'tmall_jd',  # 抖音电商按国内电商规则
        'dealer': 'dealer',  # 经销商不归一化，触发转人工
        'amazon': 'amazon',
    }
    return mapping.get(channel, channel)


def _load_policy_routing() -> dict:
    """路由表（内联版本，避免路径依赖）"""
    return {"rules": [
    {
        "match": {
            "channel": "official_site",
            "region": "US",
            "category": "power_bank"
        },
        "policy": {
            "warranty_months": 24,
            "return_window_days": 30,
            "return_rule": "30 天无理由退货：需全配件+原包装，非质量原因买家承担运费，退款到仓验收后 3-5 个工作日原路退回",
            "sop_branch": "US_OFFICIAL_RMA",
            "source": "anker.com warranty timeline + 30-Day Money-Back FAQ"
        }
    },
    {
        "match": {
            "channel": "amazon",
            "region": "US",
            "category": "power_bank"
        },
        "policy": {
            "warranty_months": 24,
            "return_window_days": 30,
            "return_rule": "退款联系亚马逊平台办理；保修由 Anker 官方承担",
            "sop_branch": "US_AMAZON_SPLIT",
            "source": "官方 FAQ：非官网购买的退款需联系零售商"
        }
    },
    {
        "match": {
            "channel": "tmall_jd",
            "region": "CN",
            "category": "power_bank"
        },
        "policy": {
            "warranty_months": 18,
            "return_window_days": 7,
            "return_rule": "三包：7 日内性能故障可退可换；8-15 日可换；16 日-1 年免费修（同故障两次修不好可换）；需发票+三包凭证",
            "sop_branch": "CN_THREE_GUARANTEES",
            "source": "Anker 中国三包政策文档"
        }
    },
    {
        "match": {
            "channel": "tmall_jd",
            "region": "CN",
            "category": "earbuds"
        },
        "policy": {
            "warranty_months": 18,
            "return_window_days": 7,
            "return_rule": "同 CN 三包规则",
            "sop_branch": "CN_THREE_GUARANTEES",
            "source": "Anker 中国三包政策文档"
        }
    },
    {
        "match": {
            "channel": "official_site",
            "region": "EU",
            "category": "earbuds"
        },
        "policy": {
            "warranty_months": 24,
            "return_window_days": 30,
            "return_rule": "欧盟法定 2 年保修优先于品牌承诺",
            "sop_branch": "EU_STATUTORY",
            "source": "欧盟消费者法定保修通则"
        }
    },
    {
        "match": {
            "channel": "any",
            "region": "CN",
            "category": "any",
            "condition": "non_cn_sold"
        },
        "policy": {
            "sop_branch": "REGION_LOCKED",
            "return_rule": "非中国大陆销售的 Anker 产品不享受中国大陆三包服务",
            "source": "Anker 中国保修文档例外条款"
        }
    }
]}


def _match_sop_branch(order: dict) -> str:
    """
    按 order 的 channel/region/category 匹配 sop_branch
    返回: sop_branch 字符串 或 'TRANSFER_HUMAN' / 'FALLBACK_ESCALATE'
    """
    routing = _load_policy_routing()

    # 经销商订单直接转人工
    if order.get('channel') == 'dealer' or order.get('dealer'):
        return 'TRANSFER_HUMAN'

    normalized_channel = _normalize_channel(order.get('channel', ''))
    region = order.get('region', '')
    category = order.get('product_category', '')

    # 第一轮: 严格匹配 (channel + region + category)
    for rule in routing.get('rules', []):
        m = rule.get('match', {})
        if (m.get('channel') == normalized_channel and
            m.get('region') == region and
            m.get('category') == category):
            return rule.get('policy', {}).get('sop_branch', 'FALLBACK_ESCALATE')

    # 第二轮: any × region × category
    for rule in routing.get('rules', []):
        m = rule.get('match', {})
        if (m.get('channel') == 'any' and
            m.get('region') == region and
            m.get('category') == category):
            return rule.get('policy', {}).get('sop_branch', 'FALLBACK_ESCALATE')

    # 第三轮: any × CN × any (兜底)
    for rule in routing.get('rules', []):
        m = rule.get('match', {})
        if (m.get('channel') == 'any' and
            m.get('region') == 'CN' and
            m.get('category') == 'any'):
            return rule.get('policy', {}).get('sop_branch', 'FALLBACK_ESCALATE')

    # 全部不匹配: 转人工
    return 'FALLBACK_ESCALATE'


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
    
    # 归一化 + 路由匹配
    order_out = dict(order)
    order_out['channel_normalized'] = _normalize_channel(order.get('channel', ''))
    order_out['sop_branch'] = _match_sop_branch(order)
    return order_out


@router.post("/{order_id}")
async def get_order_post(
    order_id: str,
    query: OrderQuery = OrderQuery(),
):
    """POST 版本（Dify OpenAPI 工具更常用）"""
    return await get_order(order_id, query.region, query.channel)