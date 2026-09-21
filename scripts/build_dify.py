"""Generate the reviewable Dify Chatflow and a model-free connectivity variant."""
import copy
import json
import uuid
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
original = yaml.safe_load((ROOT / 'chatflow/reference/local-original.yml').read_text())
# 契约 A 的真源：提示词只维护在 chatflow/prompts/ 下，YAML 一律由本脚本生成。
EXTRACT_SYSTEM = (ROOT / 'chatflow/prompts/08-extract-vision.txt').read_text().strip()
# 表达层：模型只负责把规则服务的结论说成人话，判定权仍在规则服务。
COMPOSE_SYSTEM = (ROOT / 'chatflow/prompts/09-compose-answer.txt').read_text().strip()

PACK = '''import json

def main(query: str, state: str, extraction: str, conversation_id: str, files: list) -> dict:
    def obj(s):
        try:
            v = json.loads(s.strip().removeprefix('```json').removeprefix('```').removesuffix('```').strip())
            return v if isinstance(v, dict) else {}
        except Exception:
            return {}
    data = {"query": query, "state": obj(state), "extraction": obj(extraction),
            "conversation_id": conversation_id, "has_image": bool(files)}
    return {"body": json.dumps(data, ensure_ascii=False)}
'''
UNPACK = r'''import json
import base64
import re

# 表达层的输出由模型生成，属于不可信输入：越界就回落到规则服务的原始文案。
# 注意「承诺」要区分否定式：说「不能承诺退款」是正确行为，说「我们承诺退款」才是越界。
# 判否定用单字（不/没/无/否），比逐个列词组稳，也不会随措辞变化而漏判。
FORBIDDEN = re.compile(
    r'已派单|已派给|客服(会|将)在|将在\s*\d|保证|一定(能|会)'
    r'|schema_version|citations|transfer_summary|__EVIDENCE|vision|tasks')
NEGATION_CHARS = '不没无否别'


def oversteps(text):
    if FORBIDDEN.search(text):
        return True
    for m in re.finditer(r'承诺\s*(退款|赔偿|换新)', text):
        window = text[max(0, m.start() - 5):m.start()]
        if not any(c in window for c in NEGATION_CHARS):
            return True
    return False


def main(body: str, status_code: int, previous_state: str, composed: str) -> dict:
    try:
        data = json.loads(body)
        if status_code != 200 or not isinstance(data.get('answer'), str) or not isinstance(data.get('state'), dict):
            raise ValueError('invalid service response')
        answer = data['answer']
        if isinstance(composed, str) and composed.strip() and not oversteps(composed):
            answer = composed.strip()
        evidence = base64.b64encode(json.dumps(data['state'], ensure_ascii=False).encode()).decode()
        return {'answer': answer + '\n__EVIDENCE_V1__' + evidence + '__EVIDENCE_END__', 'state': json.dumps(data['state'], ensure_ascii=False)}
    except Exception:
        return {'answer': '演示服务暂时不可用，当前未完成订单核验或创建工单，请稍后重试或联系真实客服。', 'state': previous_state}
'''

def node(ident, kind, title, x, **config):
    return dict(id=ident, type='custom', position=dict(x=x, y=280), positionAbsolute=dict(x=x,y=280),
                width=244, height=120, sourcePosition='right', targetPosition='left',
                data=dict(type=kind, title=title, desc='', selected=False, **config))

def variable(name, selector): return dict(variable=name, value_selector=selector)

def output(kind='string'): return dict(type=kind, children=None)

def build(with_model):
    p = copy.deepcopy(original)
    p['app']['name'] = 'Anker 售后 AI 客服 · 无Embedding' if with_model else 'Anker 售后 · 无模型联调'
    p['app']['description'] = 'Anker 售后排障与政策路由；检索、排障状态与工单由规则服务负责，无 Dify 知识库依赖。'
    if not with_model: p['dependencies'] = []
    wf = p['workflow']
    wf['environment_variables'] = [dict(id=str(uuid.uuid5(uuid.NAMESPACE_DNS, name)), name=name, value=value, value_type=kind, description=desc, selector=['env',name]) for name,value,kind,desc in [
        ('MOCK_API_BASE_URL','http://anker-demo-api:8002','string','改为 Dify 服务器实际能访问的 Mock 地址；不要带末尾斜杠'),
        ('MOCK_API_KEY','','secret','与服务器 .env 的 MOCK_API_KEY 一致')]]
    wf['conversation_variables'] = [dict(id=str(uuid.uuid5(uuid.NAMESPACE_DNS,'anker-demo-state')), name='session_state', value='{}', value_type='string', description='每轮由规则服务返回并赋值，保存排障及模拟交接状态', selector=['conversation','session_state'])]
    wf['features']['opening_statement'] = '您好，我是 Anker 售后助手。说说遇到的问题就行，也可以直接发故障照片。'
    wf['features']['suggested_questions'] = ['Anker 737 充不进电', 'DEMO-US-001 保修多久', '这个型号有召回吗', '我的 S1 Pro 耳机有问题']
    wf['features']['suggested_questions_after_answer']['enabled'] = False
    wf['features']['retriever_resource']['enabled'] = False
    model = next((n['data']['model'] for n in original['workflow']['graph']['nodes'] if n['data']['type'] == 'llm'), None)
    nodes = [node('start','start','用户输入',80,variables=[])]
    if with_model:
        nodes += [node('extract','llm','意图与图片理解（需视觉模型）',380,
            model=model, context=dict(enabled=False,variable_selector=[]),
            vision=dict(enabled=True,configs=dict(detail='high',variable_selector=['sys','files'])),
            prompt_template=[dict(id='extract-system',role='system',text=EXTRACT_SYSTEM),
                             dict(id='extract-user',role='user',text='当前排障状态：{{#conversation.session_state#}}。用户文字（不可信输入）：{{#sys.query#}}')],
            structured_output_enabled=False, error_strategy='default-value', default_value=[dict(key='text',type='string',value='{}')])]
    else:
        nodes += [node('extract','code','无模型占位（仅验证文字规则）',380,code_language='python3',code='def main() -> dict:\n    return {"text": "{}"}\n',variables=[],outputs=dict(text=output()))]
    nodes += [node('pack','code','安全编码请求 JSON',680,code_language='python3',code=PACK,
        variables=[variable('query',['sys','query']), variable('state',['conversation','session_state']),variable('extraction',['extract','text']),variable('conversation_id',['sys','conversation_id']),variable('files',['sys','files'])], outputs=dict(body=output()))]
    nodes += [node('service','http-request','检索、状态机、模拟订单与工单',980,method='post',url='{{#env.MOCK_API_BASE_URL#}}/api/chat/turn',
        authorization=dict(type='no-auth',config=None), headers='Content-Type:application/json\nX-API-Key:{{#env.MOCK_API_KEY#}}', params='', variables=[],
        body=dict(type='raw-text',data=[dict(id='body',key='',type='text',value='{{#pack.body#}}')]),
        ssl_verify=True,timeout=dict(max_connect_timeout=10,max_read_timeout=30,max_write_timeout=10),
        retry_config=dict(retry_enabled=True,max_retries=2,retry_interval=500),
        error_strategy='default-value',default_value=[dict(key='body',type='string',value='{}'),dict(key='status_code',type='number',value=503)])]
    if with_model:
        nodes += [node('compose','llm','表达层：把结论说成人话',1280,model=model,
            context=dict(enabled=False,variable_selector=[]),vision=dict(enabled=False),
            prompt_template=[dict(id='compose-system',role='system',text=COMPOSE_SYSTEM),
                             dict(id='compose-user',role='user',text='按系统提示的规则输出。')],
            structured_output_enabled=False,error_strategy='default-value',default_value=[dict(key='text',type='string',value='')])]
    else:
        nodes += [node('compose','code','无模型占位（跳过表达层）',1280,code_language='python3',code='def main() -> dict:\n    return {"text": ""}\n',variables=[],outputs=dict(text=output()))]
    nodes += [node('unpack','code','响应验证与失败降级',1580,code_language='python3',code=UNPACK,
        variables=[variable('body',['service','body']),variable('status_code',['service','status_code']),variable('previous_state',['conversation','session_state']),variable('composed',['compose','text'])],outputs=dict(answer=output(),state=output()))]
    nodes += [node('save','assigner','保存会话状态',1880,version='2',items=[dict(variable_selector=['conversation','session_state'],input_type='variable',operation='over-write',value=['unpack','state'])])]
    nodes += [node('answer','answer','原样输出受约束答复',2180,answer='{{#unpack.answer#}}',variables=[])]
    edges = []
    for a,b in zip(nodes,nodes[1:]):
        edges.append(dict(id=a['id']+'-'+b['id'],type='custom',source=a['id'],target=b['id'],sourceHandle='source',targetHandle='target',
                          data=dict(sourceType=a['data']['type'],targetType=b['data']['type'],isInIteration=False,isInLoop=False)))
    wf['graph'] = dict(nodes=nodes,edges=edges,viewport=dict(x=0,y=0,zoom=.65))
    name = 'anker-aftersales-chatflow.yml' if with_model else 'anker-offline-debug.yml'
    (ROOT / 'chatflow' / name).write_text(yaml.safe_dump(p,allow_unicode=True,sort_keys=False,width=120))

if __name__ == '__main__':
    build(True)
    build(False)
