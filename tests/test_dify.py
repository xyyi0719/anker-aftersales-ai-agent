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


# ---------- A3：提示词是真源，YAML 由脚本生成 ----------

def nodes():
    return {n['id']: n['data'] for n in doc()['workflow']['graph']['nodes']}


def test_prompts_are_generated_from_files():
    """YAML 里的提示词必须与 chatflow/prompts/ 下的文件逐字一致，否则真源就分叉了。"""
    n = nodes()
    for node_id, rel in [('extract', 'chatflow/prompts/08-extract-vision.txt'),
                         ('compose', 'chatflow/prompts/09-compose-answer.txt')]:
        expected = (ROOT / rel).read_text().strip()
        assert n[node_id]['prompt_template'][0]['text'] == expected, \
            f'{node_id} 的提示词与 {rel} 不一致，需要重新运行 scripts/build_dify.py'


def test_extract_prompt_declares_summary():
    text = nodes()['extract']['prompt_template'][0]['text']
    assert '"summary"' in text, 'extract 契约里没有 summary 字段'
    assert '40' in text, 'summary 缺少长度约束'
    assert '留空' in text, 'summary 缺少「不确定就留空」的约束'


def test_compose_prompt_replies_first_and_reads_facts():
    """表达层要按结构化事实组织语言，而不是整段改写模板。"""
    text = nodes()['compose']['prompt_template'][0]['text']
    assert '回应用户' in text, '表达层缺少「先回应用户」的约束'
    assert 'state.tasks' in text, '表达层没有以结构化事实为准'
    assert 'ask_repeat' in text, '表达层不知道何时该换说法'
    assert '不要输出字段名' in text, '缺少字段名防泄露约束'


def test_compose_prompt_still_forbids_promises():
    """表达层的越界铁律不能被稀释掉。"""
    text = nodes()['compose']['prompt_template'][0]['text']
    for words in ('不得承诺', '原样保留'):
        assert words in text, f'表达层缺少约束：{words}'
