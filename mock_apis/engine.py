"""Bounded demo SOP. AI extracts observations; rules control transitions and replies."""
import json
import re
from mock_apis.domain import order_lookup, warranty
from mock_apis.routes.tickets import ticket
from mock_apis.routes.policy import retrieve_data as retrieve
RECALL = re.compile(r'召回|recall|爆炸|安全公告', re.I)
# 文字里的安全信号。注意「线头烧焦」是耗材问题，不触发整机安全熔断，见 ACCESSORY_HINT。
SAFETY_TEXT = re.compile(r'鼓包|冒烟|起火|漏液|烧焦|焦味|异味|自燃|swollen|smoke|on fire', re.I)
ACCESSORY_HINT = re.compile(r'线|接头|端子|cable', re.I)
# 竞品品牌：文字兜底。图片侧由 is_anker_product 判定，见 docs/03-contract.md。
COMPETITOR = re.compile(r'小米|华为|索尼|sony|bose|倍思|baseus|罗马仕|绿联|品胜|羽博', re.I)

# 契约 A 的现象分组（中文枚举，与 chatflow/prompts/08-extract-vision.txt 一致）
VISION_SAFETY = frozenset({'鼓包', '冒烟', '起火', '漏液', '焦黑', '异味'})
VISION_ACCESSORY = frozenset({'线材破损', '线材烧损'})
VISION_HARDWARE = frozenset({'接口损坏', '内部暴露'})
VISION_DAMAGE = frozenset({'外壳破损'})
VISION_SCREEN = frozenset({'屏幕异常'})

# 状态机只保存「问什么、答什么走哪条路」。怎么说出口由表达层负责，见 chatflow/prompts/09-compose-answer.txt。
TREES = {
    'Anker737': {
        'start': ('是充电宝自己充不进电，还是不能给其他设备充电？请回复“自己”或“输出”。', {'自己': 'cable', '输出': 'output'}),
        'cable': ('换过确认完好的墙插、线和充电头后仍然充不进电吗？请回复“仍不行”或“恢复了”。', {'仍不行': 'display', '恢复了': 'resolved'}),
        'display': ('充电时屏幕有反应吗？请回复“黑屏”“有显示”或“UVP”。', {'黑屏': 'hardware', '有显示': 'slow', 'UVP': 'uvp'}),
        'output': ('换过线和另一台设备后问题还在吗？请回复“仍不行”或“恢复了”。', {'仍不行': 'hardware', '恢复了': 'resolved'}),
    },
    'Soundcore': {
        'start': ('耳机是“单边无声”还是“无法连接”？请回复其中一项。', {'单边无声': 'balance', '无法连接': 'pair'}),
        'balance': ('检查手机音频平衡、佩戴及充电状态后有改善吗？请回复“仍不行”或“恢复了”。', {'仍不行': 'device', '恢复了': 'resolved'}),
        'pair': ('删除旧配对记录并重新连接后有改善吗？请回复“仍不行”或“恢复了”。', {'仍不行': 'device', '恢复了': 'resolved'}),
        'device': ('换另一台手机后问题是否还在？请回复“仍不行”或“恢复了”。', {'仍不行': 'hardware', '恢复了': 'resolved'}),
    },
}


def chat(data):
    q = data.get('query', '')
    session = data.get('conversation_id', '')
    state = data.get('state', {})
    extracted = data.get('extraction', {})
    if not isinstance(q, str) or len(q) > 8000 or not isinstance(session, str) or not 1 <= len(session) <= 200:
        raise ValueError('query 或 conversation_id 无效')
    if not isinstance(state, dict) or not isinstance(extracted, dict):
        raise ValueError('state / extraction 必须是对象')
    state = json.loads(json.dumps(state))
    if q.strip() in ('重新开始', '重置会话'):
        state = {}
    # Ignore arbitrary model-generated state transitions and policy decisions.
    # 情绪由模型判断（契约 A 的 emotion 字段）；正则仅在模型没给出时兜底。
    emotion = extracted.get('emotion')
    if emotion not in ('L0', 'L1', 'L2', 'L3'):
        emotion = 'L3' if re.search(r'投诉|315|起诉|律师|转人工|人工客服', q) else 'L2' if re.search(r'垃圾|气死|破玩意|废话|什么逻辑|怎么这么|傻逼|沙雕|扯淡|糊弄|敷衍|听不懂|复读|耍我|骗人|骗子|坑人|离谱', q) else 'L1' if re.search(r'失望|不满意|(?<!麻)烦', q) else 'L0'
    old_streak = state.get('angry_streak', 0)
    state['angry_streak'] = (old_streak if type(old_streak) is int else 0) + 1 if emotion == 'L2' else 0
    state['emotion'] = emotion
    state['last_query'] = q
    pending_policy = state.get('pending_policy', '')
    tasks = []
    texts = []
    citations = []
    def add(kind, status, message):
        tasks.append(dict(kind=kind, status=status))
        texts.append(message)
    def handoff(reason):
        summary = dict(reason=reason, query=q, product=state.get('product'), order_id=state.get('order_id'),
                       node=state.get('node'), attempted_steps=state.get('history', []), emotion=emotion, tasks=tasks)
        t = ticket(session, summary)
        state['transfer_summary'] = summary
        state['ticket'] = t
        add('handoff', 'mock_pending', f"已生成模拟交接工单 {t['ticket_id']}，尚未发送给真实客服。")
    vision = extracted.get('vision', {})
    if not isinstance(vision, dict): vision = {}
    has_image = data.get('has_image') is True
    if not has_image: vision = {}
    conf = vision.get('confidence', 0)
    if type(conf) not in (int, float) or not 0 <= conf <= 1: conf = 0
    phenomenon = vision.get('fault_phenomenon', '')
    if not isinstance(phenomenon, str): phenomenon = ''
    is_anker = vision.get('is_anker_product', True) is not False
    # 安全类现象不设置信度门槛；文字信号排除线材/接头，那属于耗材问题
    text_safety = bool(SAFETY_TEXT.search(q)) and not ACCESSORY_HINT.search(q)
    if state.get('safety_latched') or text_safety or (has_image and phenomenon in VISION_SAFETY):
        state['safety_latched'] = True
        add('safety', 'escalated', '存在安全风险：请立即停止使用和充电，勿拆机或继续排障。')
        handoff('safety_risk')
    elif has_image and not is_anker:
        state.pop('product', None)
        add('scope', 'unsupported', '图片识别到非 Anker 生态品牌的产品。本演示仅支持 Anker / Soundcore / eufy 的售后服务，建议通过对应品牌渠道处理。')
    elif COMPETITOR.search(q):
        state.pop('product', None)
        add('scope', 'unsupported', '当前演示仅覆盖 Anker 737 和 Soundcore 耳机，请联系对应品牌售后。')
    elif emotion == 'L3' or state['angry_streak'] >= 2:
        add('emotion', 'escalated', '理解您的不满，我会保留问题与已尝试步骤供专员核实。')
        handoff('complaint_or_repeated_anger')
    elif RECALL.search(q):
        add('recall', 'no_evidence', '未查询到可核验的最新召回信息，需要专员核实；这不代表该型号没有召回。')
        handoff('live_recall_unavailable')
    elif re.search(r's1\s*pro', q, re.I) or state.get('awaiting_product'):
        if state.get('awaiting_product') and re.search(r'扫地|吸奶', q):
            state.pop('awaiting_product', None)
            add('product', 'unsupported', '已记录产品品类；当前演示仅覆盖 Anker 737 和 Soundcore 耳机。')
            handoff('unsupported_product')
        else:
            state['awaiting_product'] = True
            add('product', 'waiting_user', '请确认 S1 Pro 是扫地机器人、吸奶器还是其他产品，并提供准确型号；不能按耳机套用排障。')
    else:
        previous_product = state.get('product')
        if re.search(r'737|a1289', q, re.I): state['product'] = 'Anker737'
        elif re.search(r'soundcore|声阔', q, re.I): state['product'] = 'Soundcore'
        # 契约 A：文字没给出型号时，允许用图片识别结果确立 product
        if not state.get('product') and has_image and vision.get('product_model') in TREES:
            state['product'] = vision['product_model']
        if state.get('product') != previous_product:
            state.pop('node', None)
            state['history'] = []
        order_match = re.search(r'\b(?:ANK-\d{4}-\d{3}|DEMO-(?:US|AMZ|CN)-\d{3})\b', q, re.I)
        if order_match:
            state['order_id'] = order_match.group().upper()
            order = order_lookup(state['order_id'])
            if order['found']:
                if state.get('product') and state['product'] != order['product']:
                    state.pop('node', None)
                    state['history'] = []
                state['product'] = order['product']
                add('order', 'found', f"模拟订单 {order['order_id']}：{order['product_model']}，{order['region']} / {order['channel']}，购买日期 {order['purchase_date']}。")
            else:
                add('order', 'not_found', '未找到该模拟订单，不能据此核保。')
                handoff('order_not_found')
        if re.search(r'退款|退货|换货|保修|质保|赔偿|补偿', q) or (pending_policy and order_match):
            order = order_lookup(state.get('order_id', ''))
            if not order['found']:
                state['pending_policy'] = q
                add('policy', 'waiting_user', '请提供演示订单号以核对渠道和区域；不会直接承诺退款、换新或补偿。')
            else:
                state.pop('pending_policy', None)
                evidence = retrieve(dict(query=pending_policy or q, order_id=order['order_id']))
                if evidence['answerable']:
                    add('policy', 'simulated', evidence['results'][0]['text'])
                    citations.extend(evidence['results'])
                    w = warranty(order['order_id'])
                    if w.get('in_warranty') is None:
                        add('warranty', 'needs_review', '当前订单没有可核实的模拟保修规则，需要专员审核。')
                        handoff('unknown_warranty')
                    else:
                        add('warranty', 'checked', f"模拟核保（截至 {w['as_of']}）：{'期内' if w['in_warranty'] else '期外'}，期限 {w['warranty_months']} 个月；最终权益需凭证及故障审核。")
                else:
                    handoff('policy_unavailable')
        product = state.get('product', '')
        troubleshooting = ('troubleshooting' in extracted.get('intents', []) if isinstance(extracted.get('intents'), list) else False) or bool(re.search(r'充不|充不上|没声|无声|连不上|不行|故障|黑屏|排障', q))
        if has_image and phenomenon in VISION_ACCESSORY:
            add('troubleshooting', 'advice', '图片显示损伤位于线材或接头，属于耗材问题：建议停止使用该线材，更换原装或认证线材后复测；此类情况通常不影响整机保修。')
        elif has_image and phenomenon in VISION_HARDWARE:
            add('troubleshooting', 'needs_review', '图片显示存在硬件损坏（接口或内部结构）。这属于硬件故障，需核实型号与购买凭证以判定质保范围；不会在缺少依据时承诺换新。')
        elif has_image and phenomenon in VISION_DAMAGE:
            add('troubleshooting', 'needs_review', '图片显示存在外壳破损。此类损伤可能属于人为损坏，不在免费保修范围内；可核实有偿维修方案，请提供演示订单号以便确认。')
        elif product in TREES and (state.get('node') or troubleshooting or has_image):
            tree = TREES[product]
            node = state.get('node', 'start')
            if node not in tree: node = 'start'
            history = state.get('history', [])
            if not isinstance(history, list): history = []
            # 图片只能跳过现象提问，不得跳过用户动作核验与凭证检查。
            visual_product = vision.get('product_model')
            conflict = (not is_anker) or (visual_product in TREES and visual_product != product) or ('有显示' in q and phenomenon == '屏幕异常')
            if has_image and conf >= .8 and not conflict and product == visual_product and node == 'start' and product == 'Anker737' and phenomenon in VISION_SCREEN:
                node = 'cable'
                history.append(dict(from_node='start', to_node='cable', reason='vision_symptom_only', confidence=conf))
            if has_image and conflict:
                add('vision', 'waiting_user', '图片与文字或产品信息存在冲突，请先确认准确型号和故障现象。')
            else:
                normalized = extracted.get('branch_answer', '')
                matched = None
                for label, target in tree[node][1].items():
                    if q.strip() == label or (label.lower() in q.lower() and not any(t in q for t in ('不是'+label, '没有'+label, '没'+label, '未'+label))) or normalized == label:
                        matched = (label, target)
                        break
                if not matched:
                    # 只判断「问了几轮、要不要升级」这条边界；换什么说法由表达层决定。
                    repeated = state.get('asked_node') == node
                    streak = (state.get('unanswered_streak') or 0) + 1 if repeated else 1
                    state['unanswered_streak'] = streak
                    state['asked_node'] = node
                    state['ask_repeat'] = repeated
                    state['node'] = node
                    if streak >= (2 if emotion == 'L3' else 3):
                        add('troubleshooting', 'needs_review', '来回几轮都没对上，先不追问了，把已知信息交给专员核实，避免再占用您的时间。')
                        handoff('repeated_non_answer')
                    else:
                        add('troubleshooting', 'waiting_user', tree[node][0])
                else:
                    label, target = matched
                    history.append(dict(from_node=node, to_node=target, response=label))
                    node = target
                    state['asked_node'] = None
                    state['unanswered_streak'] = 0
                    state['ask_repeat'] = False
                    if node in tree:
                        state['node'] = node
                        add('troubleshooting', 'waiting_user', tree[node][0])
                    else:
                        state.pop('node', None)
                        if node == 'resolved': add('troubleshooting', 'resolved', '已记录您确认恢复；如再次出现问题请联系售后。')
                        elif node in ('uvp', 'slow'):
                            evidence = retrieve(dict(query='UVP' if node == 'uvp' else '充电慢', filters={'product':product}))
                            if evidence['answerable'] and evidence['results']:
                                add('troubleshooting', 'answered', evidence['results'][0]['text'])
                                citations.extend(evidence['results'])
                            else:
                                handoff('retrieval_unavailable')
                        else:
                            add('troubleshooting', 'needs_review', '交叉排查后仍异常，需售后核实硬件问题；不会自动判定换新。')
                            state['history'] = history[-30:]
                            handoff('hardware_review')
            state['history'] = history[-30:]
        elif not tasks:
            if has_image:
                add('product', 'waiting_user', '请用文字确认准确型号与故障现象；图片单独识别不能确定售后政策。')
            else:
                evidence = retrieve(dict(query=q or '未知', filters={'product':product}))
                if evidence['answerable']:
                    add('faq', 'answered', evidence['results'][0]['text'])
                    citations.extend(evidence['results'][:1])
                else:
                    add('faq', 'no_evidence', '当前资料不足，请补充准确型号与故障；无法核实的事项需要专员确认。')
    if citations:
        texts += ['参考快照：' + c['chunk_id'] + (' ' + c['metadata']['source_url'] if c['metadata'].get('source_url') else '（模拟配置）') for c in citations]
    state['tasks'] = tasks
    state['citations'] = citations
    state['vision'] = vision if has_image else {}
    state['schema_version'] = 1
    state['mock'] = True
    return dict(mock=True, answer='\n'.join(texts),
                state=state, tasks=tasks, citations=citations, transfer_summary=state.get('transfer_summary', {}))

