import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from mock_apis.app import app
from mock_apis.domain import route, warranty
from retrieval.lexical import retriever

@pytest.fixture
def client(tmp_path,monkeypatch):
    monkeypatch.setenv('TICKET_DB',str(tmp_path/'tickets.db'))
    monkeypatch.setenv('DEMO_TODAY','2026-09-20')
    monkeypatch.delenv('RETRIEVAL_URL',raising=False)
    monkeypatch.delenv('MOCK_API_KEY',raising=False)
    return TestClient(app)

def turn(client,q,state=None,**kw):
    response=client.post('/api/chat/turn',json=dict(query=q,conversation_id='test-conversation',state=state or {},**kw))
    assert response.status_code==200,response.text
    return response.json()

@pytest.mark.parametrize('query,expected',[
 ('充电宝充不进电','f1'),('不能给手机充电','f2'),('Anker 737 死机','f3'),('Anker 737 发热','f4'),
 ('Anker 737 掉电快','f5'),('Anker 737 闲置掉电','f6'),('iPhone 80% 停充','f7'),
 ('USB-A 0.1W','f8'),('737 UVP','f9'),('输出达不到140W','f10'),('多口插拔断连','f11'),('充电慢','f12'),
 ('耳机单边没声音','s1'),('耳机不开机','s2'),('耳机配对失败','s3'),('耳机配对后无声','s4'),('耳机音量不一致','s5')])
def test_faq(query,expected):
    result=retriever.search(query)
    assert result['answerable'],result
    assert result['results'][0]['chunk_id'].endswith('_'+expected),result
    assert result['results'][0]['metadata']['source_url'].startswith('https://')

@pytest.mark.parametrize('q',['今天天气如何','asdfzxcvqwerty','有召回吗','会不会爆炸','保修多久'])
def test_no_unsupported_claim(q):
    assert retriever.search(q)['answerable'] is False

def test_filter():
    assert retriever.search('737充不进电',filters={'product':'Soundcore'})['answerable'] is False
    assert retriever.search('充不进电',filters={'region':'XX'})['answerable'] is False

def test_routes():
    assert route(dict(region='EU',channel='unknown',product_category='unknown')) is None
    assert route(dict(region='CN',channel='unknown',product_category='unknown')) is None
    assert route(dict(region='CN',channel='unknown',product_category='unknown',non_cn_sold=True))['sop_branch']=='REGION_LOCKED'

def test_warranty_uses_order(client):
    r=client.post('/api/warranty/check',json={'order_id':'DEMO-US-001','purchase_date':'2099-01-01','product_model':'fake'})
    assert r.json()['purchase_date']=='2026-08-15'
    assert r.json()['warranty_months']==24
    assert r.json()['in_warranty'] is True
    assert warranty('ANK-2024-001')['in_warranty'] is False
    assert warranty('DEMO-CN-001')['warranty_months']==18
    assert warranty('UNKNOWN')['in_warranty'] is None

def test_policy_needs_order(client):
    assert client.post('/api/policy/retrieve',json={'query':'退货'}).json()['answerable'] is False
    r=client.post('/api/policy/retrieve',json={'query':'退货','order_id':'DEMO-AMZ-001'}).json()
    assert r['sop_branch']=='US_AMAZON_SPLIT'

def test_recall_persistent_ticket(client):
    a=turn(client,'有召回吗')
    b=turn(client,'有召回吗')
    assert '不代表' in a['answer']
    assert a['state']['ticket']==b['state']['ticket']
    assert a['state']['ticket']['dispatched'] is False

def test_danger_latches(client):
    a=turn(client,'Anker 737 鼓包了')
    b=turn(client,'继续给我排障',a['state'])
    assert b['tasks'][0]['kind']=='safety'
    assert '停止使用' in b['answer']

def test_s1_disambiguation(client):
    a=turn(client,'我的S1 Pro耳机有问题')
    assert a['state']['awaiting_product']
    b=turn(client,'扫地机器人',a['state'])
    assert 'awaiting_product' not in b['state']
    assert b['state']['ticket']['dispatched'] is False

def test_multiturn(client):
    state={}
    for q,expected in [('Anker 737 充不进电','start'),('自己','cable'),('仍不行','display')]:
        a=turn(client,q,state);state=a['state'];assert state['node']==expected
    b=turn(client,'黑屏',state)
    assert b['state']['ticket']['ticket_id'].startswith('MOCK-')
    assert b['state']['transfer_summary']['attempted_steps'][-1]['to_node']=='hardware'

def test_negative_response_does_not_advance(client):
    a=turn(client,'Anker 737 充不进电')
    a=turn(client,'自己',a['state'])
    a=turn(client,'没有恢复了',a['state'])
    assert a['state']['node']=='cable'

def test_vision_threshold_and_conflict(client):
    for confidence,expected in [(.4,'start'),(.9,'cable')]:
        a=turn(client,'Anker 737',has_image=True,extraction={'vision':{'product_model':'Anker737','fault_phenomenon':'屏幕异常','confidence':confidence}})
        assert a['state']['node']==expected
    a=turn(client,'Anker 737有显示',has_image=True,extraction={'vision':{'product_model':'Anker737','fault_phenomenon':'屏幕异常','confidence':.9}})
    assert any(t['kind']=='vision' and t['status']=='waiting_user' for t in a['tasks'])

def test_multi_intent_and_pending_policy(client):
    a=turn(client,'Anker 737 充不进电还想保修')
    assert {'policy','troubleshooting'} <= {t['kind'] for t in a['tasks']}
    b=turn(client,'DEMO-US-001',a['state'])
    assert 'warranty' in {t['kind'] for t in b['tasks']}

def test_input_and_auth(client,monkeypatch):
    assert client.post('/api/policy/retrieve',json={'query':'x','top_k':-1}).status_code==422
    assert client.post('/api/chat/turn',json={'conversation_id':'x','state':[]}).status_code==422
    monkeypatch.setenv('MOCK_API_KEY','test-key')
    assert client.post('/api/orders/DEMO-US-001').status_code==401
    assert client.post('/api/orders/DEMO-US-001',headers={'X-API-Key':'test-key'}).status_code==200

def test_service_timeout_fails_closed(client,monkeypatch):
    import httpx
    monkeypatch.setenv('RETRIEVAL_URL','http://example.invalid')
    def timeout(*args,**kwargs): raise httpx.ReadTimeout('timeout')
    monkeypatch.setattr(httpx,'post',timeout)
    result=client.post('/api/policy/retrieve',json={'query':'充不进电'}).json()
    assert result['answerable'] is False and result['results']==[]
