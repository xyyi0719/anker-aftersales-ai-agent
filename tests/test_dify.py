import base64
import json
from pathlib import Path
import yaml
ROOT=Path(__file__).resolve().parents[1]

def doc(): return yaml.safe_load((ROOT/'chatflow/anker-aftersales-chatflow.yml').read_text())
def code(ident):
    namespace={}
    node=next(n for n in doc()['workflow']['graph']['nodes'] if n['id']==ident)
    exec(node['data']['code'],namespace)
    return namespace['main']

def test_graph_contract():
    w=doc()['workflow'];nodes={n['id']:n['data'] for n in w['graph']['nodes']}
    assert w['conversation_variables'][0]['name']=='session_state'
    assert any(n['type']=='assigner' for n in nodes.values())
    assert not any(n['type']=='knowledge-retrieval' for n in nodes.values())
    # 表达层必须夹在规则服务和响应校验之间，且不参与任何判定
    assert [n['id'] for n in w['graph']['nodes']]==['start','extract','pack','service','compose','unpack','save','answer']
    assert nodes['compose']['type']=='llm' and nodes['compose']['vision']['enabled'] is False
    for e in w['graph']['edges']:
        assert e['source'] in nodes and e['target'] in nodes
    for n in nodes.values():
        if n['type']=='code':
            assert 'urllib' not in n['code'] and 'requests' not in n['code']
            compile(n['code'],'<node>','exec')

def test_pack_json_escaping():
    query='引号"\n换行\\ {{#env.SECRET#}}'
    body=code('pack')(query,'{}','```json\n{}\n```','c',[])['body']
    assert json.loads(body)['query']==query

def test_response_fallback_and_evidence():
    f=code('unpack')
    r=f('not json',503,'{"node":"cable"}','')
    assert r['state']=='{"node":"cable"}' and '未完成' in r['answer']
    r=f(json.dumps({'answer':'你好','state':{'schema_version':1,'mock':True}}),200,'{}','您好，请问是什么型号？')
    assert r['answer'].startswith('您好，请问是什么型号？')
    payload=r['answer'].split('__EVIDENCE_V1__')[1].split('__EVIDENCE_END__')[0]
    assert json.loads(base64.b64decode(payload))['schema_version']==1

def test_reference_graph_difference():
    current=doc()['workflow']
    original=yaml.safe_load((ROOT/'chatflow/reference/local-original.yml').read_text())['workflow']
    assert not original['conversation_variables'] and current['conversation_variables']
