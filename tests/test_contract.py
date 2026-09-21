"""契约测试：三端接口契约的 Mock 侧断言。见 docs/03-contract.md。

这些用例锁定 contract A（extraction）与 contract B（state）的行为。
违反契约时应当失败，而不是被兜底掩盖。
"""
import json

import pytest
from fastapi.testclient import TestClient
from mock_apis.app import app
from mock_apis.engine import TREES, OPTION_LABELS, options_for

from test_dify import code as node_main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('TICKET_DB', str(tmp_path / 'tickets.db'))
    monkeypatch.setenv('DEMO_TODAY', '2026-09-21')
    monkeypatch.delenv('RETRIEVAL_URL', raising=False)
    monkeypatch.delenv('MOCK_API_KEY', raising=False)
    return TestClient(app)


def turn(client, q, state=None, vision=None, has_image=False, emotion=None, branch_answer='', summary=None):
    body = dict(query=q, conversation_id='contract-conversation', state=state or {}, has_image=has_image)
    extraction = dict(vision=vision or {}, intents=[], branch_answer=branch_answer)
    if emotion:
        extraction['emotion'] = emotion
    if summary is not None:
        extraction['summary'] = summary
    body['extraction'] = extraction
    r = client.post('/api/chat/turn', json=body)
    assert r.status_code == 200, r.text
    return r.json()


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

BENCHMARK = [
    ('01', '我发一下我的充电宝照片，麻烦帮我看看', 'Anker737', '正常', ('troubleshooting', 'waiting_user')),
    ('02', '这是我的包装盒，型号对得上吗？', 'Anker737', '正常', ('troubleshooting', 'waiting_user')),
    ('03', '我的 737 外壳裂开了，好像有点膨胀', 'unknown', '鼓包', ('safety', 'escalated')),
    ('04', '这个充电宝侧面鼓起来了，还能继续充吗？', 'unknown', '鼓包', ('safety', 'escalated')),
    ('05', '线头好像烧焦了，接口有一股焦味', 'unknown', '线材烧损', ('troubleshooting', 'advice')),
    ('06', '插口里面的塑料片掉了，插线接触不良', 'unknown', '接口损坏', ('troubleshooting', 'needs_review')),
    ('07', '线皮破了里面的金属网露出来了', 'unknown', '线材破损', ('troubleshooting', 'advice')),
    ('08', '接头这里破损了，充得慢', 'unknown', '线材破损', ('troubleshooting', 'advice')),
    ('09', '耳机掉地上壳子摔裂了，能保修吗？', 'unknown', '外壳破损', ('troubleshooting', 'needs_review')),
    ('10', '耳机耳机头脱开了，里面线都露在外面', 'unknown', '内部暴露', ('troubleshooting', 'needs_review')),
    ('11', '这个充电宝能帮我看看坏了吗？', 'unknown', 'unknown', ('scope', 'unsupported')),
    ('12', '我买的这个充不进电，你们能修吗？', 'unknown', 'unknown', ('scope', 'unsupported')),
]


@pytest.mark.parametrize('cid,query,model,phenomenon,expected', BENCHMARK)
def test_benchmark_image_cases(client, cid, query, model, phenomenon, expected):
    is_anker = cid not in ('11', '12')
    r = turn(client, query, has_image=True,
             vision=dict(brand='baseus' if not is_anker else 'unknown',
                         product_model=model, fault_location='待识别',
                         fault_phenomenon=phenomenon, confidence=.9,
                         is_anker_product=is_anker))
    assert expected in kinds(r), f'{cid} 期望 {expected}，实际 {kinds(r)}'
    assert r['state'].get('vision', {}).get('fault_phenomenon') == phenomenon


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
