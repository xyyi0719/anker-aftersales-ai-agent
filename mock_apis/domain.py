"""Single source of demo order and policy rules. No real entitlement decisions."""
import calendar
import json
import os
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ORDERS = {o['order_id']: o for o in json.loads((ROOT/'data/orders.json').read_text())}
USERS = {u['user_id']: u for u in json.loads((ROOT/'data/users.json').read_text())}
POLICIES = json.loads((ROOT.parent/'knowledge_base/policy_routing.json').read_text())['rules']
CHANNELS = {'official':'official_site','jd':'tmall_jd','tmall':'tmall_jd','douyin':'tmall_jd'}

def route(order):
    if order.get('dealer') or order.get('channel') == 'dealer': return None
    channel = CHANNELS.get(order.get('channel'),order.get('channel'))
    for rule in sorted(POLICIES, key=lambda r: not bool(r['match'].get('condition'))):
        m = rule['match']
        if m.get('condition') and not order.get(m['condition']): continue
        if all(m.get(k) in ('any',v) for k,v in [('channel',channel),('region',order.get('region')),('category',order.get('product_category'))]):
            return rule['policy']
    return None

def order_lookup(order_id):
    order = ORDERS.get(order_id)
    if not order: return dict(found=False, mock=True, order_id=order_id, sop_branch='TRANSFER_HUMAN')
    policy = route(order)
    product = 'Anker737' if order['product_model'] == 'Anker 737' else 'Soundcore' if 'Soundcore' in order['product_model'] else 'unknown'
    return dict(order, found=True, mock=True, product=product,
                channel_normalized=CHANNELS.get(order['channel'],order['channel']),
                sop_branch=policy['sop_branch'] if policy else 'FALLBACK_ESCALATE')

def warranty(order_id):
    order = order_lookup(order_id)
    policy = route(order) if order['found'] else None
    months = policy.get('warranty_months') if policy else None
    if not months: return dict(order, in_warranty=None, reason='unsupported_order_or_policy')
    start = date.fromisoformat(order['purchase_date'])
    today = date.fromisoformat(os.environ.get('DEMO_TODAY') or date.today().isoformat())
    n = start.month - 1 + months
    year,month = start.year + n//12, n%12+1
    end = date(year,month,min(start.day,calendar.monthrange(year,month)[1]))
    return dict(order, warranty_months=months, warranty_end_date=end.isoformat(), warranty_expires=end.isoformat(),
                in_warranty=start<=today<=end, days_remaining=max(0,(end-today).days), as_of=today.isoformat(),
                reason='demo_only_subject_to_receipt_and_fault_review')

def user_profile(user_id):
    """模拟用户档案。orders_count 由订单实时统计，不写死在档案里；查不到就显式返回 not found。"""
    user = USERS.get(user_id) if user_id else None
    if not user:
        return dict(found=False, mock=True, user_id=user_id or '')
    owned = sorted(o['order_id'] for o in ORDERS.values() if o.get('user_id') == user_id)
    return dict(user, found=True, mock=True, orders_count=len(owned), order_ids=owned)


def policy_evidence(query, order_id):
    order = order_lookup(order_id)
    policy = route(order) if order['found'] else None
    from retrieval.lexical import SAFETY
    if not policy or SAFETY.search(query):
        return dict(mock=True, answerable=False, confidence=0.0, results=[], low_confidence_reason='no_verified_policy')
    chunk = dict(chunk_id='demo_policy_'+policy['sop_branch'].lower(), score=1.0,
                 text='模拟政策：'+policy['return_rule']+'。最终适用性需核实购买凭证与故障，不构成退换或补偿承诺。',
                 metadata=dict(source='参赛政策配置快照', source_url='', region=order['region'], channel=order['channel_normalized'], verified_live=False))
    return dict(mock=True, answerable=True, confidence=1.0, confidence_kind='rule_match_not_probability',
                results=[chunk], sop_branch=policy['sop_branch'])
