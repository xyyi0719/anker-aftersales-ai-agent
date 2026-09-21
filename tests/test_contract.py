"""契约测试：三端接口契约的 Mock 侧断言。见 docs/03-contract.md。

这些用例锁定 contract A（extraction）与 contract B（state）的行为。
违反契约时应当失败，而不是被兜底掩盖。
"""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from mock_apis.app import app
from mock_apis.engine import TREES, OPTION_LABELS, options_for
from mock_apis.domain import order_lookup, user_profile

from test_dify import code as node_main

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('TICKET_DB', str(tmp_path / 'tickets.db'))
    monkeypatch.setenv('DEMO_TODAY', '2026-09-21')
    monkeypatch.delenv('RETRIEVAL_URL', raising=False)
    monkeypatch.delenv('MOCK_API_KEY', raising=False)
    return TestClient(app)


def turn(client, q, state=None, vision=None, has_image=False, emotion=None, branch_answer='', summary=None,
         conv='contract-conversation'):
    body = dict(query=q, conversation_id=conv, state=state or {}, has_image=has_image)
    extraction = dict(vision=vision or {}, intents=[], branch_answer=branch_answer)
    if emotion:
        extraction['emotion'] = emotion
    if summary is not None:
        extraction['summary'] = summary
    body['extraction'] = extraction
    r = client.post('/api/chat/turn', json=body)
    assert r.status_code == 200, r.text
    return r.json()


def make_ticket(client, q='Anker 737 鼓包了', conv='contract-conversation'):
    """跑一轮会生成工单的对话，返回 (ticket_id, conversation_id)。"""
    r = turn(client, q, conv=conv)
    ticket = r['state'].get('ticket') or {}
    assert ticket.get('ticket_id'), f'这一轮没有生成工单：{r["state"].get("tasks")}'
    return ticket['ticket_id'], conv


def act(client, conv, action, ticket_id, headers=None):
    return client.post('/api/chat/action',
                       json=dict(conversation_id=conv, action=action, ticket_id=ticket_id),
                       headers=headers)


def kinds(result):
    return [(t['kind'], t['status']) for t in result['tasks']]


# ---------- 契约 A：品牌判定 ----------

@pytest.mark.parametrize('query', ['这个充电宝能帮我看看坏了吗？', '我买的这个充不进电，你们能修吗？'])
def test_non_anker_image_is_rejected(client, query):
    """is_anker_product=false 时不得进入排障流程。"""
    r = turn(client, query, has_image=True,
             vision=dict(product_model='unknown', fault_location='机身',
                         fault_phenomenon='unknown', confidence=.9, is_anker_product=False))
    assert ('scope', 'unsupported') in kinds(r)


@pytest.mark.parametrize('query', ['倍思的充电宝坏了', 'baseus 充电宝充不进电'])
def test_competitor_brand_text_is_rejected(client, query):
    r = turn(client, query)
    assert ('scope', 'unsupported') in kinds(r)


def test_unknown_brand_does_not_reject(client):
    """看不清品牌时不得拒答。"""
    r = turn(client, '这个充电宝能帮我看看吗？', has_image=True,
             vision=dict(product_model='unknown', fault_location='机身',
                         fault_phenomenon='unknown', confidence=.9, is_anker_product=True))
    assert ('scope', 'unsupported') not in kinds(r)


# ---------- 契约 A：图片型号参与设定 product ----------

def test_vision_sets_product_when_text_has_none(client):
    """图片识别出的型号必须能确立 product，否则 01/02 永远进不了排障。"""
    r = turn(client, '我发一下我的充电宝照片，麻烦帮我看看', has_image=True,
             vision=dict(product_model='Anker737', fault_location='机身',
                         fault_phenomenon='正常', confidence=.92, is_anker_product=True))
    assert r['state'].get('product') == 'Anker737'
    assert ('troubleshooting', 'waiting_user') in kinds(r)
    assert '自己' in r['answer']


# ---------- 契约 A：现象驱动的有界处理 ----------

@pytest.mark.parametrize('phenomenon,expected_status', [
    ('线材破损', 'advice'),
    ('线材烧损', 'advice'),
    ('接口损坏', 'needs_review'),
    ('内部暴露', 'needs_review'),
    ('外壳破损', 'needs_review'),
])
def test_vision_phenomenon_handled_without_product(client, phenomenon, expected_status):
    """硬件类现象不需要型号也能给出有界处理。"""
    r = turn(client, '帮我看看这张图', has_image=True,
             vision=dict(product_model='unknown', fault_location='线材接头',
                         fault_phenomenon=phenomenon, confidence=.85, is_anker_product=True))
    assert ('troubleshooting', expected_status) in kinds(r)
    assert ('safety', 'escalated') not in kinds(r)


def test_cable_damage_is_low_risk_not_escalated(client):
    r = turn(client, '线皮破了里面的金属网露出来了', has_image=True,
             vision=dict(product_model='unknown', fault_location='线材',
                         fault_phenomenon='线材破损', confidence=.85, is_anker_product=True))
    assert ('safety', 'escalated') not in kinds(r)
    assert ('troubleshooting', 'advice') in kinds(r)


# ---------- 契约 A：安全类不受置信度门槛限制 ----------

@pytest.mark.parametrize('phenomenon', ['鼓包', '冒烟', '起火', '漏液'])
def test_safety_phenomenon_ignores_confidence(client, phenomenon):
    r = turn(client, '帮我看看', has_image=True,
             vision=dict(product_model='unknown', fault_location='电芯',
                         fault_phenomenon=phenomenon, confidence=.3, is_anker_product=True))
    assert ('safety', 'escalated') in kinds(r)


def test_cable_burn_text_does_not_latch_device_safety(client):
    """「线头烧焦」是耗材问题，不应触发整机安全熔断。"""
    r = turn(client, '线头好像烧焦了，接口有一股焦味')
    assert ('safety', 'escalated') not in kinds(r)


def test_device_overheat_text_still_latches(client):
    r = turn(client, 'Anker 737 鼓包了')
    assert ('safety', 'escalated') in kinds(r)


# ---------- 契约 B：无图时 vision 必须清空 ----------

def test_vision_cleared_without_image(client):
    a = turn(client, '帮我看看', has_image=True,
             vision=dict(product_model='Anker737', fault_location='机身',
                         fault_phenomenon='正常', confidence=.9, is_anker_product=True))
    b = turn(client, 'Anker 737 充不进电', a['state'], has_image=False)
    assert b['state'].get('vision') == {}


# ---------- 12 张基准图的端到端期望（契约验收基线） ----------

# ---------- 12 张基准图的端到端期望（与 scripts/eval_metrics.py 共用同一份数据） ----------

BENCHMARK = [(c['id'], c['query'], c['vision'], tuple(c['expect_task']))
             for c in json.loads((ROOT / 'mock_apis/data/vision_benchmark.json').read_text())]


@pytest.mark.parametrize('cid,query,vision,expected', BENCHMARK)
def test_benchmark_image_cases(client, cid, query, vision, expected):
    r = turn(client, query, has_image=True, vision=vision)
    assert expected in kinds(r), f'{cid} 期望 {expected}，实际 {kinds(r)}'
    assert r['state'].get('vision', {}).get('fault_phenomenon') == vision.get('fault_phenomenon')


# ---------- 对话推进：理解与表达归模型，代码只守边界 ----------

def test_model_emotion_is_used(client):
    """情绪由模型判断，模型给出的值优先。"""
    r = turn(client, '你们这个到底行不行', emotion='L2')
    assert r['state']['emotion'] == 'L2'


def test_keyword_emotion_is_only_fallback(client):
    """模型没给情绪时才用关键词兜底。"""
    assert turn(client, '垃圾', emotion='L0')['state']['emotion'] == 'L0'
    assert turn(client, '垃圾')['state']['emotion'] == 'L2'


def test_non_answer_sets_repeat_flag_instead_of_hardcoded_wording(client):
    """用户没回答时，代码只标记「这是重复追问」，换什么说法交给表达层。"""
    a = turn(client, 'Anker 737 充不进电')
    assert a['state']['ask_repeat'] is False
    b = turn(client, '废话，问这个有什么用', a['state'], emotion='L2')
    assert b['state']['ask_repeat'] is True, '未把重复追问的信号交给表达层'
    assert ('troubleshooting', 'waiting_user') in kinds(b), '没有继续推进排障'


def test_repeated_non_answer_escalates_instead_of_looping(client):
    """连续答非所问必须升级，这是代码要守的边界。"""
    a = turn(client, 'Anker 737 充不进电')
    b = turn(client, '废话', a['state'], emotion='L2')
    c = turn(client, '你到底在问什么', b['state'], emotion='L2')
    assert ('handoff', 'mock_pending') in kinds(c), '反复追问仍未升级'
    assert ('troubleshooting', 'waiting_user') not in kinds(c)


def test_answer_after_repeat_still_advances(client):
    """换说法追问之后再答对，排障仍能继续。"""
    a = turn(client, 'Anker 737 充不进电')
    b = turn(client, '废话', a['state'], emotion='L2')
    c = turn(client, '自己', b['state'])
    assert c['state']['node'] == 'cable'


def test_answer_has_no_self_referential_demo_banner(client):
    """答复里不再自报"这是演示"。"""
    r = turn(client, 'Anker 737 充不进电')
    assert '参赛演示' not in r['answer']


# ---------- A1：引导选项 options ----------

def test_first_ask_carries_two_options(client):
    """排障首问必须带可点选项，value 是故障树选项键。"""
    r = turn(client, 'Anker 737 充不进电')
    opts = r['state']['options']
    assert [o['value'] for o in opts] == ['自己', '输出']


def test_option_labels_are_plain_language(client):
    """选项文案要说人话，不能把系统词直接摆给用户。"""
    r = turn(client, 'Anker 737 充不进电')
    for o in r['state']['options']:
        assert o['label'] != o['value'], f"选项文案没做人话转换：{o}"
        for jargon in ('输出', 'UVP'):
            assert jargon not in o['label'], f"选项文案里出现系统词 {jargon}：{o}"


def test_options_never_exceed_three():
    """任何产品的任何节点，选项上限为 3。"""
    for product, tree in TREES.items():
        for node in tree:
            opts = options_for(product, node)
            assert len(opts) <= 3, f'{product}/{node} 选项超过 3 个'
            assert opts, f'{product}/{node} 是追问节点但没有选项'


def test_every_option_key_has_a_label():
    """故障树里的每个选项键都必须有人话文案，否则回退会露出系统词。"""
    for product, tree in TREES.items():
        for node, (_, branches) in tree.items():
            for key in branches:
                assert key in OPTION_LABELS, f'{product}/{node} 的选项键 {key} 没有配置显示文案'


@pytest.mark.parametrize('query', ['Anker 737 鼓包了', '倍思的充电宝坏了',
                                   'DEMO-US-001 保修多久', '耳机单边没声音'])
def test_non_ask_replies_carry_no_options(client, query):
    """安全熔断、边界拒答、政策核保、FAQ 都不带选项。"""
    assert turn(client, query)['state']['options'] == []


def test_option_value_advances_the_tree(client):
    """把选项的 value 当 query 发回来，排障要能推进。"""
    a = turn(client, 'Anker 737 充不进电')
    value = a['state']['options'][0]['value']
    b = turn(client, value, a['state'])
    assert b['state']['node'] == 'cable'
    assert {o['value'] for o in b['state']['options']} == {'仍不行', '恢复了'}


def test_free_text_with_branch_answer_advances(client):
    """不用点选项，用户自由打字由模型归一后同样能推进。"""
    a = turn(client, 'Anker 737 充不进电')
    b = turn(client, '给手机充不进去啊', a['state'], branch_answer='输出')
    assert b['state']['node'] == 'output'


def test_options_recomputed_each_turn(client):
    """选项随节点重算，不复用上一轮的。"""
    a = turn(client, 'Anker 737 充不进电')
    b = turn(client, '自己', a['state'])
    assert [o['value'] for o in a['state']['options']] == ['自己', '输出']
    assert [o['value'] for o in b['state']['options']] == ['仍不行', '恢复了']


# ---------- A1：会话摘要 summary ----------

def test_summary_passthrough_and_carryover(client):
    """模型给了就用模型的；没给或给了空白要沿用上一轮，绝不在后端拼。"""
    a = turn(client, 'Anker 737 充不进电', summary='在排查 737 充不进电，刚进入排障')
    assert a['state']['summary'] == '在排查 737 充不进电，刚进入排障'

    b = turn(client, '自己', a['state'])
    assert b['state']['summary'] == '在排查 737 充不进电，刚进入排障', '模型没给摘要时应沿用上一轮'

    c = turn(client, '仍不行', b['state'], summary='已确认换线无效，下一步确认屏幕反应')
    assert c['state']['summary'] == '已确认换线无效，下一步确认屏幕反应'

    d = turn(client, '黑屏', c['state'], summary='   ')
    assert d['state']['summary'] == '已确认换线无效，下一步确认屏幕反应', '空白摘要不应覆盖已有值'


def test_summary_reset_clears_it(client):
    """新会话必须清空摘要，不能跨会话带过来。"""
    a = turn(client, 'Anker 737 充不进电', summary='旧会话摘要')
    b = turn(client, '重新开始', a['state'])
    assert b['state']['summary'] == ''


# ---------- A1：任务携带结构化事实（供表达层组织语言）----------

def test_tasks_carry_message_for_the_composer(client):
    """每个任务要带 message，表达层才能按事实组织语言而不是改写模板。"""
    r = turn(client, 'Anker 737 充不进电')
    for t in r['state']['tasks']:
        assert set(t) >= {'kind', 'status', 'message'}, f'任务缺少结构化字段：{t}'
        assert t['message'].strip()


# ---------- 表达层的越界拦截（直接跑生成后的 YAML 里的代码节点）----------

def test_composed_answer_out_of_bounds_falls_back():
    """模型改写的措辞越界时，必须回落到规则服务的原文。"""
    main = node_main('unpack')
    body = json.dumps({'answer': '模拟核保：期内，期限 24 个月；最终权益需凭证及故障审核。',
                       'state': {'schema_version': 1, 'mock': True}})
    for bad in ['已派单给专员，客服将在 15 分钟内联系您',
                '我们保证为您免费换新',
                '尊敬的客户，schema_version 显示已通过']:
        r = main(body, 200, '{}', bad)
        assert '24 个月' in r['answer'], f'越界输出未被拦截：{bad}'
        assert bad not in r['answer']


def test_composed_answer_within_bounds_is_used():
    main = node_main('unpack')
    body = json.dumps({'answer': '模拟核保：期内，期限 24 个月。', 'state': {'schema_version': 1, 'mock': True}})
    good = '这台设备还在保修期内，期限 24 个月，最终以凭证和故障审核为准。'
    r = main(body, 200, '{}', good)
    assert good in r['answer']
    assert '__EVIDENCE_V1__' in r['answer']


def test_composed_answer_empty_falls_back():
    main = node_main('unpack')
    body = json.dumps({'answer': '模拟核保：期内，期限 24 个月。', 'state': {'schema_version': 1, 'mock': True}})
    assert '24 个月' in main(body, 200, '{}', '')['answer']


# ---------- A2：用户档案 ----------

DEMO_ORDERS = ['DEMO-US-001', 'DEMO-AMZ-001', 'DEMO-CN-001']


@pytest.mark.parametrize('order_id', DEMO_ORDERS)
def test_demo_order_holder_has_a_profile(order_id):
    """每位 DEMO 订单持有者都必须能在 users.json 查到，否则中层档案是空的。"""
    order = order_lookup(order_id)
    assert order['found']
    uid = order.get('user_id')
    assert uid, f'{order_id} 没有关联用户'
    profile = user_profile(uid)
    assert profile['found'], f'{uid} 不在 users.json 里'
    for field in ('name', 'tier', 'joined', 'orders_count'):
        assert profile.get(field) not in (None, ''), f'档案缺字段 {field}'
    assert profile['orders_count'] >= 1


def test_every_order_links_to_a_known_user():
    """订单的 user_id 不能指向不存在的档案。"""
    from mock_apis.domain import ORDERS
    for oid, order in ORDERS.items():
        uid = order.get('user_id')
        assert uid, f'{oid} 没有 user_id'
        assert user_profile(uid)['found'], f'{oid} 关联的 {uid} 不存在'


def test_unknown_user_is_not_fabricated():
    """查不到的档案要显式 found=False，不许返回假姓名。"""
    profile = user_profile('U-NOT-A-REAL-USER')
    assert profile['found'] is False
    assert not profile.get('name')


def test_orders_count_is_computed_not_hardcoded():
    """orders_count 必须由订单数据算出来，不能写死在档案里。"""
    from mock_apis.domain import ORDERS
    uid = order_lookup('DEMO-US-001')['user_id']
    expected = sum(1 for o in ORDERS.values() if o.get('user_id') == uid)
    assert user_profile(uid)['orders_count'] == expected


# ---------- A2：转派动作接口 ----------

def test_transfer_succeeds(client):
    ticket_id, conv = make_ticket(client)
    r = act(client, conv, 'transfer_to_agent', ticket_id)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data['ok'] is True
    assert data['ticket']['status'] == 'transfer_requested'
    assert data['ticket']['dispatched'] is False, '未对接真实队列，dispatched 必须为 false'


def test_transfer_is_idempotent(client):
    ticket_id, conv = make_ticket(client)
    first = act(client, conv, 'transfer_to_agent', ticket_id).json()
    second = act(client, conv, 'transfer_to_agent', ticket_id).json()
    assert second['ok'] is True
    assert second['ticket']['status'] == first['ticket']['status'] == 'transfer_requested'


def test_non_whitelisted_action_is_rejected(client):
    """权限锁的边界：接口本身也不接受退款、补偿这类动作。"""
    ticket_id, conv = make_ticket(client)
    for action in ('refund', 'compensate', 'transfer_to_human', ''):
        assert act(client, conv, action, ticket_id).status_code == 400, f'{action} 未被拒绝'


def test_unknown_ticket_returns_404(client):
    """归属校验优先：用自己的会话 ID 去查一个从未生成的工单，才是 404。"""
    from mock_apis.routes.tickets import ticket_id_for
    conv = 'never-escalated'
    assert act(client, conv, 'transfer_to_agent', ticket_id_for(conv)).status_code == 404


def test_mismatched_ticket_id_is_forbidden(client):
    """会话对不上任何工单时按越权处理，不泄露其它工单是否存在。"""
    make_ticket(client, conv='someone-else')
    from mock_apis.routes.tickets import ticket_id_for
    assert act(client, 'contract-conversation', 'transfer_to_agent',
               ticket_id_for('someone-else')).status_code == 403


def test_ticket_ownership_is_enforced(client):
    """工单 ID 是会话哈希，用别人的 conversation_id 必须被拒。"""
    ticket_id, _ = make_ticket(client, conv='owner-conversation')
    assert act(client, 'someone-else', 'transfer_to_agent', ticket_id).status_code == 403


def test_action_requires_api_key(client, monkeypatch):
    ticket_id, conv = make_ticket(client)
    monkeypatch.setenv('MOCK_API_KEY', 'test-key')
    assert act(client, conv, 'transfer_to_agent', ticket_id).status_code == 401
    assert act(client, conv, 'transfer_to_agent', ticket_id,
               headers={'X-API-Key': 'test-key'}).status_code == 200


def test_action_input_validation(client):
    assert client.post('/api/chat/action', json={'action': 'transfer_to_agent'}).status_code == 422
    assert client.post('/api/chat/action', json={'conversation_id': 'x', 'action': 'transfer_to_agent'}).status_code == 422


def test_transferred_status_is_readable_next_turn(client):
    """转派后，下一轮对话的 state.ticket.status 必须是新状态，不能被覆盖回 mock_pending。"""
    ticket_id, conv = make_ticket(client)
    act(client, conv, 'transfer_to_agent', ticket_id)
    r = turn(client, 'Anker 737 鼓包了', conv=conv)
    assert r['state']['ticket']['status'] == 'transfer_requested'
    assert r['state']['ticket']['dispatched'] is False


# ---------- A2：旧库迁移 ----------

def test_status_column_migrates_from_legacy_db(tmp_path, monkeypatch):
    """线上已有的是 (id, summary) 两列旧库；CREATE TABLE IF NOT EXISTS 不会补列，
    必须靠显式迁移，否则线上第一次转派就会 500。"""
    import sqlite3
    from mock_apis.routes.tickets import _connect, transfer, ticket_id_for

    db = tmp_path / 'legacy.sqlite3'
    conn = sqlite3.connect(db)
    conn.execute('CREATE TABLE tickets (id TEXT PRIMARY KEY, summary TEXT NOT NULL)')
    conn.execute('INSERT INTO tickets VALUES (?,?)', ('MOCK-LEGACY0000000000', '{"node":"hardware"}'))
    conn.commit()
    conn.close()

    monkeypatch.setenv('TICKET_DB', str(db))

    migrated = _connect(db)
    cols = {row[1] for row in migrated.execute('PRAGMA table_info(tickets)')}
    assert 'status' in cols, '旧库没有被补上 status 列'
    rows = list(migrated.execute('SELECT id, summary, status FROM tickets'))
    assert len(rows) == 1 and rows[0][0] == 'MOCK-LEGACY0000000000', '迁移过程把已有工单弄丢了'
    assert rows[0][2] is None, '旧工单的 status 应为空，由读取方兜底成 mock_pending'

    # 旧工单迁移后也要能被转派
    session = 'legacy-conversation'
    conn2 = sqlite3.connect(db)
    conn2.execute('INSERT INTO tickets (id,summary) VALUES (?,?)', (ticket_id_for(session), '{}'))
    conn2.commit()
    conn2.close()
    assert transfer(session, ticket_id_for(session))['ok'] is True


def test_migration_runs_only_once(tmp_path, monkeypatch):
    """重复打开同一库不应报错（迁移必须幂等）。"""
    from mock_apis.routes.tickets import _connect
    db = tmp_path / 'repeat.sqlite3'
    for _ in range(3):
        _connect(db).execute('SELECT 1').fetchone()
    cols = {row[1] for row in _connect(db).execute('PRAGMA table_info(tickets)')}
    assert cols == {'id', 'summary', 'status'}


def test_openapi_spec_is_current():
    """openapi_spec.json 要跟当前 app 一致——它会被上传到 Dify 做工具集成，过期就会误导接入方。"""
    from pathlib import Path
    from mock_apis.app import app as current_app
    spec = json.loads((Path(__file__).resolve().parents[1] / 'mock_apis/openapi_spec.json').read_text())
    assert spec == current_app.openapi(), 'openapi_spec.json 已过期，需重新生成'


def test_negated_promise_phrasing_is_not_treated_as_overreach():
    """「不能承诺退款」是正确表述，不该被越界拦截丢掉——否则退款话术永远保持机械。"""
    main = node_main('unpack')
    body = json.dumps({'answer': '不会直接承诺退款、换新或补偿。', 'state': {'schema_version': 1, 'mock': True}})
    for ok in ['需要您提供订单号，我们不能直接承诺退款或换新。',
               '这项我没法承诺退款，得先核实凭证。',
               '不构成退换或补偿承诺，最终以审核为准。']:
        assert main(body, 200, '{}', ok)['answer'].startswith(ok), f'被误判为越界：{ok}'


def test_affirmative_promise_is_still_blocked():
    """真正的越界承诺仍要被拦下。"""
    main = node_main('unpack')
    body = json.dumps({'answer': '规则服务原文。', 'state': {'schema_version': 1, 'mock': True}})
    for bad in ['我们承诺退款给您', '这边承诺换新', '已派单给专员', '客服将在 15 分钟内联系您', '保证给您免费换新']:
        assert main(body, 200, '{}', bad)['answer'].startswith('规则服务原文。'), f'未被拦截：{bad}'


# ---------- A4：契约一致性检查（防变形核心）----------

def _contract_sources():
    from scripts import check_contract as cc
    return cc, cc.load_sources()


def test_contract_check_passes_on_this_repo():
    cc, sources = _contract_sources()
    assert cc.run_checks(sources) == [], cc.run_checks(sources)


def test_contract_check_catches_undeclared_state_field():
    """后端多产出一个字段而契约没记，必须被发现。"""
    cc, sources = _contract_sources()
    sources['mock_apis/engine.py'] += "\n    state['undeclared_field'] = 1\n"
    assert any('undeclared_field' in p for p in cc.run_checks(sources))


def test_contract_check_catches_phenomenon_enum_drift():
    cc, sources = _contract_sources()
    key = 'docs/V2/spec/00-契约冻结.md'
    sources[key] = sources[key].replace('`外壳破损` ', '')
    assert any('现象枚举不一致' in p for p in cc.run_checks(sources))


def test_contract_check_catches_safety_phenomenon_drift():
    """安全类分组一旦两端不一致，熔断行为就会分叉。"""
    cc, sources = _contract_sources()
    key = 'frontend/src/components/VisionInspector.tsx'
    sources[key] = sources[key].replace("SAFETY_PHENOMENA = ['鼓包'",
                                        "SAFETY_PHENOMENA = ['冒烟'")
    assert any('安全类现象不一致' in p for p in cc.run_checks(sources))


def test_contract_check_catches_threshold_drift():
    cc, sources = _contract_sources()
    key = 'frontend/src/components/VisionInspector.tsx'
    sources[key] = sources[key].replace('CONFIDENCE_THRESHOLD = 0.8',
                                        'CONFIDENCE_THRESHOLD = 0.75')
    assert any('置信度阈值不一致' in p for p in cc.run_checks(sources))


def test_contract_check_catches_missing_prompt_field():
    """契约 A 声明了 summary，提示词却漏掉，也必须被发现。"""
    cc, sources = _contract_sources()
    key = 'chatflow/prompts/08-extract-vision.txt'
    sources[key] = sources[key].replace('"summary": "",', '')
    assert any('summary' in p for p in cc.run_checks(sources))


def test_contract_check_catches_missing_section():
    cc, sources = _contract_sources()
    key = 'docs/V2/spec/00-契约冻结.md'
    sources[key] = sources[key].replace('## 契约 B · state', '## 契约 Bx · state')
    with pytest.raises(cc.ContractError):
        cc.run_checks(sources)


def test_contract_check_fails_loudly_when_table_is_broken():
    """最关键的一条：表格被改坏时必须报错退出，绝不能「解析成空集合 → 检查通过」。"""
    import re as _re
    cc, sources = _contract_sources()
    key = 'docs/V2/spec/00-契约冻结.md'
    sources[key] = _re.sub(r'`([A-Za-z_][A-Za-z0-9_\[\]{}]*)`', r'\1', sources[key])
    with pytest.raises(cc.ContractError):
        cc.run_checks(sources)


# ---------- A4：指标脚本 ----------

def _metrics():
    from scripts import eval_metrics as em
    return em


def test_metrics_all_pass_on_this_repo():
    em = _metrics()
    result, failures = em.collect()
    assert em.meets_thresholds(result), failures
    assert result['induced']['passed'] == result['induced']['total']
    assert result['vision_behavior']['passed'] == result['vision_behavior']['total']


def test_metrics_are_reproducible():
    """连续两次跑必须完全一致（判定集里不许有随机）。"""
    em = _metrics()
    assert em.collect()[0] == em.collect()[0]


def test_metrics_threshold_gate_actually_fails():
    """阈值门禁必须真的会拦——否则不达标也能通过。"""
    em = _metrics()
    base, _ = em.collect()
    import copy
    weak = copy.deepcopy(base)
    weak['induced'] = {'passed': 9, 'total': 10, 'rate': 0.9}
    assert em.meets_thresholds(weak) is False
    weak = copy.deepcopy(base)
    weak['routing'] = {'passed': 20, 'total': 26, 'rate': 0.769}
    assert em.meets_thresholds(weak) is False
    weak = copy.deepcopy(base)
    weak['vision_behavior'] = {'passed': 9, 'total': 12}
    assert em.meets_thresholds(weak) is False


def test_metrics_never_claim_visual_accuracy():
    """口径纪律：不得把「看图行为正确率」写成「视觉识别准确率」。"""
    em = _metrics()
    result, _ = em.collect()
    assert '不等于视觉识别准确率' in result['note']
    source = (ROOT / 'scripts/eval_metrics.py').read_text()
    assert '视觉识别准确率' in source
    assert '看图行为正确率' in source
