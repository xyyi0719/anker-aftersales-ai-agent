"""从视觉基准真源生成前端展示数据。

真源是 mock_apis/data/vision_benchmark.json —— 它同时被 tests/test_contract.py 与
scripts/eval_metrics.py 消费。前端不再手写一份用例表，否则「期望行为」这句话会两边
各写一遍，代码改了而文案不改。

生成物：frontend/src/data/benchmarkCases.ts
用法：python scripts/build_benchmark_cases.py    # 幂等，重跑无 diff
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'mock_apis/data/vision_benchmark.json'
TARGET = ROOT / 'frontend/src/data/benchmarkCases.ts'

# 契约 A 的现象/型号取值里，unknown 表示「看了但判断不出」。
# 契约 C 的取值纪律：unknown 一律显示为「未识别」，不留英文占位（docs/V2/spec/00-契约冻结.md）。
UNKNOWN = '未识别'

# 型号取值域是契约规定的一套短名，界面要显示成人能读的形式。
MODEL_LABELS = {'Anker737': 'Anker 737', 'Soundcore': 'Soundcore'}
CATEGORIES = ['正常', '故障-安全', '故障', '边界']


def category_of(case):
    """分类由真源里已有的判定结果派生，不另存一个会过期的手写字段。

    派生顺序即优先级：边界拒答 > 安全熔断 > 无损伤 > 其余故障。
    """
    task = tuple(case['expect_task'])
    if task == ('scope', 'unsupported'):
        return '边界'
    if task == ('safety', 'escalated'):
        return '故障-安全'
    if case['vision'].get('fault_phenomenon') == '正常':
        return '正常'
    return '故障'


def reading_of(case):
    """「期望识别」一行，逐字取自真源的结构化字段。

    这里刻意只做字段拼接，不做措辞润色——一旦润色就又多了一处会与现象枚举分叉的文案。
    """
    vision = case['vision']
    parts = []
    brand = vision.get('brand')
    if brand and brand != 'unknown':
        parts.append('品牌 ' + brand)
    if vision.get('is_anker_product') is False:
        parts.append('非 Anker 产品')
    model = MODEL_LABELS.get(vision.get('product_model'), vision.get('product_model'))
    parts.append('型号 ' + (model if model and model != 'unknown' else UNKNOWN))
    for label, key in (('部位', 'fault_location'), ('现象', 'fault_phenomenon')):
        value = vision.get(key)
        parts.append(f'{label} ' + (value if value and value != 'unknown' else UNKNOWN))
    return ' · '.join(parts)


def cases():
    # 显式指定编码：生成结果必须与本机 locale 无关，否则「生成物是否过期」的测试会随环境抖动。
    raw = json.loads(SOURCE.read_text(encoding='utf-8'))
    return [dict(id=c['id'], category=category_of(c), file=c['file'], title=c['title'],
                 query=c['query'], expectedReading=reading_of(c),
                 expectedAction=c['expected_action']) for c in raw]


def render():
    items = cases()
    lines = [
        '// 本文件由 scripts/build_benchmark_cases.py 生成，请勿手改。',
        '// 真源：mock_apis/data/vision_benchmark.json；改真源后重跑脚本。',
        '',
        "export type BenchmarkCategory = '正常' | '故障-安全' | '故障' | '边界';",
        '',
        'export interface BenchmarkCase {',
        '  id: string;',
        '  category: BenchmarkCategory;',
        '  /** 真源中的图片文件名，位于 public/test-images/ 下 */',
        '  file: string;',
        '  title: string;',
        '  /** 点选该用例时装进会话的用户提问，与评测用的一致 */',
        '  query: string;',
        '  /** 期望识别结果，由真源的 vision 字段拼装 */',
        '  expectedReading: string;',
        '  expectedAction: string;',
        '}',
        '',
        "export const BENCHMARK_CATEGORIES: BenchmarkCategory[] = "
        + json.dumps(CATEGORIES, ensure_ascii=False) + ';',
        '',
        'export const BENCHMARK_CASES: BenchmarkCase[] = [',
    ]
    for item in items:
        lines.append('  {')
        for key in ('id', 'category', 'file', 'title', 'query', 'expectedReading', 'expectedAction'):
            lines.append(f'    {key}: {json.dumps(item[key], ensure_ascii=False)},')
        lines.append('  },')
    lines += ['];', '']
    return '\n'.join(lines)


def main():
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(render(), encoding='utf-8')
    print(TARGET)


if __name__ == '__main__':
    main()
