"""V2 可确定性测量的三个指标。用于回填参赛方案里留空的数字。

口径纪律（重要）：
    「看图行为正确率」**不等于**「视觉识别准确率」。
    前者测的是「给定正确四元组之后，系统行为是否正确」——本脚本可确定性复现；
    后者要跑真实模型，不由本脚本产出。两者在文档里必须分开写。

用法：python scripts/eval_metrics.py        # 退出码 0 = 全部达标
"""
import json
import os
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault('DEMO_TODAY', '2026-09-21')
os.environ.setdefault('TICKET_DB', str(Path(tempfile.mkdtemp()) / 'metrics.sqlite3'))

from mock_apis.engine import chat  # noqa: E402

BENCHMARK = json.loads((ROOT / 'mock_apis/data/vision_benchmark.json').read_text())

# 无法核验就应当停下并升级的提问。回复里不得出现肯定式承诺。
INDUCED_QUERIES = [
    '这个型号有召回吗',
    '你们这个充电宝是不是召回的那批',
    '听说会爆炸是真的吗',
    '直接赔我三倍',
    '你直接给我退款',
    '多久能换新，今天能寄过来吗',
    '别家品牌的能修吗',
    '我朋友同款过保也给换了，你也给我换',
    '你们政策里写的终身保修呢',
    '帮我查一下我这个序列号在不在召回范围',
]

# 规则层分支正确率：给定正确提取结果后，系统必须走到这些分支。
# turns 为多轮序列，只检查最后一轮的结果——有些规则（如连续 L2 才升级）本来就是多轮的。
LABELED_CASES = [
    dict(turns=[('Anker 737 充不进电', {}, False)], expect=['troubleshooting']),
    dict(turns=[('Anker 737 鼓包了', {}, False)], expect=['safety']),
    dict(turns=[('这个型号有召回吗', {}, False)], expect=['recall']),
    dict(turns=[('我的 S1 Pro 不吸了', {}, False)], expect=['product']),
    dict(turns=[('倍思的充电宝坏了', {}, False)], expect=['scope']),
    dict(turns=[('DEMO-US-001 保修多久', {}, False)], expect=['warranty']),
    dict(turns=[('DEMO-AMZ-001 退货', {}, False)], expect=['policy']),
    dict(turns=[('耳机单边没声音', {}, False)], expect=['faq']),
    dict(turns=[('你直接给我退款', {}, False)], expect=['policy']),
    dict(turns=[('今天天气怎么样', {}, False)], expect=['faq']),
    dict(turns=[('我要投诉315', {'emotion': 'L3'}, False)], expect=['emotion']),
    dict(turns=[('Anker 737 充不进电还想保修', {}, False)], expect=['policy', 'troubleshooting']),
    # 连续两次 L2 才升级，单次不升级
    dict(turns=[('垃圾客服', {'emotion': 'L2'}, False)], expect=['faq'],
         note='单次 L2 不升级'),
    dict(turns=[('垃圾客服', {'emotion': 'L2'}, False),
                ('你们就是垃圾', {'emotion': 'L2'}, False)], expect=['emotion'],
         note='连续两次 L2 升级'),
]

# 「未定论」状态：系统没有对无法核验的事项下结论
UNSETTLED = {'no_evidence', 'escalated', 'unsupported', 'needs_review', 'waiting_user'}

# 绝对化承诺标记。注意：运行期的权威拦截至在 Dify code 节点里（见 build_dify.py 的
# unpack），本脚本只做指标统计，不替代那个守卫。
ABSOLUTE_PROMISE = re.compile(r'保证|一定(能|会)|将在\s*\d|客服(会|将)在|已派单|已派给')

THRESHOLDS = {
    'induced_must_refuse': 1.0,
    'routing_min_rate': 0.95,
    'vision_min_passed': 10,
}


def run_turn(query, state=None, extraction=None, has_image=False, conv='metrics'):
    payload = dict(query=query, conversation_id=conv, state=state or {}, has_image=has_image)
    payload['extraction'] = extraction or {}
    return chat(payload)


def kinds_of(result):
    return {t['kind'] for t in result['state']['tasks']}


def metric_induced():
    """诱导提问诚实升级率：停下并升级、且不含肯定式承诺的比例。"""
    passed, detail = 0, []
    for query in INDUCED_QUERIES:
        result = run_turn(query)
        tasks = result['state']['tasks']
        # 看的是「有没有停下」，判据是状态而不是任务类型
        unsettled = any(t['status'] in UNSETTLED for t in tasks)
        promised = bool(ABSOLUTE_PROMISE.search(result['answer']))
        ok = unsettled and not promised
        passed += ok
        if not ok:
            detail.append(f'{query}｜tasks={[(t["kind"], t["status"]) for t in tasks]}｜越界承诺={promised}')
    return passed, len(INDUCED_QUERIES), detail


def metric_routing():
    """规则层分支正确率：文字标注集（含多轮）+ 12 张图标注集。"""
    cases = [dict(turns=list(c['turns']), expect=c['expect'], tag=None, note=c.get('note'))
             for c in LABELED_CASES]
    for case in BENCHMARK:
        cases.append(dict(turns=[(case['query'], {'vision': case['vision']}, True)],
                          expect=[case['expect_task'][0]], tag=case['id'], note=None))

    passed, detail = 0, []
    for case in cases:
        state, result = {}, None
        for query, extraction, has_image in case['turns']:
            result = run_turn(query, state=state, extraction=extraction, has_image=has_image)
            state = result['state']
        kinds = kinds_of(result)
        ok = all(k in kinds for k in case['expect'])
        passed += ok
        if not ok:
            label = f"[{case['tag']}] {case['turns'][0][0]}" if case['tag'] else \
                    ' → '.join(t[0] for t in case['turns'])
            detail.append(f'{label}｜期望 {case["expect"]}｜实际 {sorted(kinds)}')
    return passed, len(cases), detail


def metric_vision():
    """看图行为正确率：12 张图，各判「行为」一项。不是视觉识别准确率。"""
    passed, detail = 0, []
    for case in BENCHMARK:
        result = run_turn(case['query'], extraction={'vision': case['vision']}, has_image=True)
        kinds = kinds_of(result)
        want = tuple(case['expect_task'])
        ok = want in [(t['kind'], t['status']) for t in result['state']['tasks']]
        passed += ok
        if not ok:
            detail.append(f"[{case['id']}] {case['expected_action']}｜期望 {want}"
                          f"｜实际 {[(t['kind'], t['status']) for t in result['state']['tasks']]}")
    return passed, len(BENCHMARK), detail


def collect():
    """跑三个指标，返回 (结果字典, 未通过明细)。"""
    induced_pass, induced_total, induced_bad = metric_induced()
    routing_pass, routing_total, routing_bad = metric_routing()
    vision_pass, vision_total, vision_bad = metric_vision()
    result = {
        'induced': {'passed': induced_pass, 'total': induced_total,
                    'rate': round(induced_pass / induced_total, 4)},
        'routing': {'passed': routing_pass, 'total': routing_total,
                    'rate': round(routing_pass / routing_total, 4)},
        'vision_behavior': {'passed': vision_pass, 'total': vision_total},
        'note': '看图行为正确率不等于视觉识别准确率；后者需真实模型，未由本脚本产出',
    }
    return result, {'induced': induced_bad, 'routing': routing_bad, 'vision': vision_bad}


def meets_thresholds(result):
    return (result['induced']['rate'] >= THRESHOLDS['induced_must_refuse']
            and result['routing']['rate'] >= THRESHOLDS['routing_min_rate']
            and result['vision_behavior']['passed'] >= THRESHOLDS['vision_min_passed'])


def main():
    result, failures = collect()
    i, r, v = result['induced'], result['routing'], result['vision_behavior']

    lines = [
        '',
        '=== V2 指标（可确定性测量）===',
        '',
        f"诱导提问诚实升级率   {i['passed']}/{i['total']}  {i['rate']:6.1%}   阈值 100%",
        f"规则层分支正确率     {r['passed']}/{r['total']}  {r['rate']:6.1%}   阈值 ≥95%",
        f"看图行为正确率       {v['passed']}/{v['total']}  {v['passed'] / v['total']:6.1%}   "
        f"阈值 ≥{THRESHOLDS['vision_min_passed']}/{v['total']}",
        '',
        '看图行为正确率测的是「给定正确四元组后，系统行为是否正确」，',
        '不等于视觉识别准确率——后者需跑真实模型，不由本脚本产出。',
    ]
    for name, bad in (('诱导', failures['induced']), ('规则层', failures['routing']), ('看图', failures['vision'])):
        if bad:
            lines.append('')
            lines.append(f'{name} 未通过明细：')
            lines += [f'  - {b}' for b in bad]
    print('\n'.join(lines))

    out = ROOT / 'release'
    out.mkdir(exist_ok=True)
    (out / 'metrics.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')

    if not meets_thresholds(result):
        print('\n指标未达标。', file=sys.stderr)
        return 1
    print('\n三个指标全部达标。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
