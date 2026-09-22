"""视觉测试集：真源完整性 + 前端生成物不过期。

真源是 mock_apis/data/vision_benchmark.json，它同时被 tests/test_contract.py 与
scripts/eval_metrics.py 消费。前端弹窗的用例表由 scripts/build_benchmark_cases.py 生成，
不再手写——手写过一次，结果「期望行为」这句话两边各写一遍，代码改了文案没改（见
`1c47738` 撤下时的三条不符描述）。
"""
import json
from pathlib import Path

import pytest

from scripts import build_benchmark_cases as bb

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_IMAGES = ROOT / 'frontend/public/test-images'
GENERATED = ROOT / 'frontend/src/data/benchmarkCases.ts'

REQUIRED = {'id', 'file', 'title', 'query', 'vision', 'expected_action', 'expect_task'}

# 真源里不该出现的手写字段：分类由 expect_task + fault_phenomenon 派生，另存就会过期。
FORBIDDEN_FIELDS = {'category'}


@pytest.fixture(scope='module')
def source():
    raw = json.loads(bb.SOURCE.read_text(encoding='utf-8'))
    # 解析不出来时不要静默变成空集合让检查通过
    assert isinstance(raw, list) and len(raw) == 12, f'真源应恰好 12 条，实际 {len(raw) if isinstance(raw, list) else type(raw)}'
    return raw


def cases(source):
    return {c['id']: c for c in source}


# ---------- 生成物不过期 ----------

def test_generated_file_exists():
    assert GENERATED.exists(), f'缺少生成物 {GENERATED.name}，请运行 scripts/build_benchmark_cases.py'


def test_generated_file_is_current():
    """手改生成物、或改了真源却忘了重跑脚本，都必须失败。"""
    assert GENERATED.read_text(encoding='utf-8') == bb.render(), \
        'frontend/src/data/benchmarkCases.ts 与真源不一致，请运行 scripts/build_benchmark_cases.py'


# ---------- 真源完整性 ----------

def test_ids_are_01_to_12(source):
    assert [c['id'] for c in source] == [f'{n:02d}' for n in range(1, 13)]


@pytest.mark.parametrize('field', sorted(REQUIRED))
def test_every_case_declares_field(source, field):
    missing = [c.get('id') for c in source if field not in c]
    assert not missing, f'这些用例缺少 {field}：{missing}'


def test_source_carries_no_manually_maintained_category(source):
    """分类若被写进真源，就会有人只改它不改判定结果。"""
    offenders = [c['id'] for c in source if FORBIDDEN_FIELDS & set(c)]
    assert not offenders, f'真源里出现了应派生的字段：{offenders}'


def test_every_case_file_exists_in_public(source):
    """弹窗按 /test-images/<file> 取图，文件不在就只剩占位。"""
    missing = [c['file'] for c in source if not (PUBLIC_IMAGES / c['file']).exists()]
    assert not missing, f'public/test-images 下找不到这些图片：{missing}'


def test_public_dir_has_no_internal_checklist():
    """测试清单只应留在素材库；放 public 下会被 Nginx 直接对外提供。"""
    leaked = [p.name for p in PUBLIC_IMAGES.iterdir() if p.suffix == '.md']
    assert not leaked, f'public/test-images 下不应有文档文件：{leaked}'


# ---------- 文案与代码行为一致 ----------

def test_no_case_claims_a_tree_jump(source):
    """engine.py 只在「屏幕异常」时跳过现象提问，而 12 例里没有屏幕异常。"""
    phenomena = {c['vision'].get('fault_phenomenon') for c in source}
    assert '屏幕异常' not in phenomena, \
        '真源里出现了「屏幕异常」用例，下面这条「不得出现跳级」的断言需要重新评估'

    offenders = [c['id'] for c in source if '跳级' in c['expected_action']]
    assert not offenders, f'这些用例声称跳级，但代码不会跳级：{offenders}'


def test_no_unsupported_official_claim(source):
    """图片来自公开网页，不是官方发布的基准集。"""
    offenders = [c['id'] for c in source
                 if '官方' in c['title'] or '官方' in c['expected_action']]
    assert not offenders, f'这些用例的可见文案出现无依据的「官方」：{offenders}'


def test_needs_review_cases_do_not_promise_outcomes(source):
    """转人工类用例不得承诺换新、退款、时长。"""
    banned = ('保证', '一定换', '免费换新', '当天', '小时内', '分钟内')
    offenders = [c['id'] for c in source
                 if any(w in c['expected_action'] for w in banned)]
    assert not offenders, f'这些用例的期望行为含承诺性措辞：{offenders}'


# ---------- 派生结果 ----------

def test_categories_match_source_semantics(source):
    counts = {}
    for c in source:
        counts[bb.category_of(c)] = counts.get(bb.category_of(c), 0) + 1
    assert counts == {'正常': 2, '故障-安全': 2, '故障': 6, '边界': 2}, counts


def test_reading_renders_unknown_as_chinese(source):
    """契约 C 的取值纪律：unknown 显示为「未识别」，不留英文。"""
    for c in source:
        reading = bb.reading_of(c)
        assert 'unknown' not in reading.lower(), f"{c['id']} 的期望识别行残留英文占位：{reading}"


def test_boundary_cases_are_flagged_not_applicable(source):
    """非 Anker 用例必须显式标出拒答前提，不能只写型号。"""
    by_id = cases(source)
    for cid in ('11', '12'):
        assert '非 Anker 产品' in bb.reading_of(by_id[cid]), f'{cid} 没有标出非 Anker'
