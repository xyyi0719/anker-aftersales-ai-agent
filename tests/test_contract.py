"""契约测试：三端接口契约的 Mock 侧断言。见 docs/03-contract.md。

这些用例锁定 contract A（extraction）与 contract B（state）的行为。
违反契约时应当失败，而不是被兜底掩盖。
"""
import pytest
from fastapi.testclient import TestClient
from mock_apis.app import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('TICKET_DB', str(tmp_path / 'tickets.db'))
    monkeypatch.setenv('DEMO_TODAY', '2026-09-21')
    monkeypatch.delenv('RETRIEVAL_URL', raising=False)
    monkeypatch.delenv('MOCK_API_KEY', raising=False)
    return TestClient(app)


def turn(client, q, state=None, vision=None, has_image=False):
    body = dict(query=q, conversation_id='contract-conversation', state=state or {}, has_image=has_image)
    body['extraction'] = dict(vision=vision or {}, intents=[], branch_answer='')
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
