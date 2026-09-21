"""契约一致性检查：三端字段与取值域必须与 docs/V2/spec/00-契约冻结.md 一致。

设计原则（重要）：
    解析不到就报错退出，**绝不能出现「解析失败 → 空集合 → 检查通过」**。
    所以每处解析都带数量下限断言，表格被改坏时会直接失败而不是静默放行。

用法：python scripts/check_contract.py     # 退出码 0 = 通过；1 = 不一致；2 = 无法执行
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'docs/V2/spec/00-契约冻结.md': ROOT / 'docs/V2/spec/00-契约冻结.md',
    'mock_apis/engine.py': ROOT / 'mock_apis/engine.py',
    'chatflow/prompts/08-extract-vision.txt': ROOT / 'chatflow/prompts/08-extract-vision.txt',
    'frontend/src/components/VisionInspector.tsx': ROOT / 'frontend/src/components/VisionInspector.tsx',
}

# 契约 A 里不出现在任何 VISION_* 分组、但合法的取值：它们表示「不做任何分支动作」
NEUTRAL_PHENOMENA = {'正常', 'unknown'}

ROW = re.compile(r'^\|\s*\*{0,2}`([A-Za-z_][A-Za-z0-9_]*(?:\{\}|\[\])?)`\*{0,2}')
TICKED = re.compile(r'`([^`]+)`')
NUMBER = re.compile(r'conf\s*>=\s*(\.?\d+(?:\.\d+)?)')


class ContractError(Exception):
    pass


def load_sources():
    missing = [name for name, path in SOURCES.items() if not path.exists()]
    if missing:
        raise ContractError('找不到文件：' + '、'.join(missing))
    return {name: path.read_text() for name, path in SOURCES.items()}


def section(text, prefix):
    """取出 '## <prefix>...' 到下一个 '## ' 之间的内容；找不到就报错。
    前缀必须恰好是一个词——'契约 B' 不应匹配到 '契约 Bx'。"""
    out, inside = [], False
    for line in text.splitlines():
        if line.startswith('## '):
            title = line[3:]
            rest = title[len(prefix):] if title.startswith(prefix) else None
            inside = rest is not None and (rest == '' or not rest[0].isalnum())
            continue
        if inside:
            out.append(line)
    if out:
        return '\n'.join(out)
    raise ContractError(f'契约文档里找不到章节：## {prefix}…')


def table_fields(block):
    # 字段名可能带 [] 或 {} 后缀（citations[] / vision{}），统一去掉
    fields = [ROW.match(l).group(1).rstrip('[]{}') for l in block.splitlines() if ROW.match(l)]
    if not fields:
        raise ContractError('解析不出任何字段——表格格式可能被改坏了')
    return fields


def enum_of(block, field):
    for line in block.splitlines():
        m = ROW.match(line)
        if m and m.group(1) == field:
            return set(TICKED.findall(line)[1:])
    raise ContractError(f'契约里找不到字段 {field} 的取值域')


def engine_state_keys(text):
    keys = set(re.findall(r"state\[['\"]([a-z_]+)['\"]\]\s*=", text))
    keys |= set(re.findall(r"state\.pop\(['\"]([a-z_]+)['\"]", text))
    if len(keys) < 8:
        raise ContractError(f'从 engine.py 只解析出 {len(keys)} 个 state 键，明显不对')
    return keys


def engine_phenomenon_sets(text):
    found = dict(re.findall(r'(VISION_[A-Z_]+)\s*=\s*frozenset\(\{([^}]*)\}\)', text))
    if len(found) < 4:
        raise ContractError(f'从 engine.py 只解析出 {len(found)} 个 VISION_* 分组，明显不对')
    return {name: set(re.findall(r"'([^']+)'", body)) for name, body in found.items()}


def frontend_safety_phenomena(text):
    m = re.search(r'SAFETY_PHENOMENA\s*=\s*\[([^\]]*)\]', text)
    if not m:
        raise ContractError('前端 VisionInspector 里找不到 SAFETY_PHENOMENA')
    return set(re.findall(r"'([^']+)'", m.group(1)))


def frontend_confidence_threshold(text):
    m = re.search(r'CONFIDENCE_THRESHOLD\s*=\s*([0-9.]+)', text)
    if not m:
        raise ContractError('前端 VisionInspector 里找不到 CONFIDENCE_THRESHOLD')
    return float(m.group(1))


def run_checks(sources):
    """返回问题清单；空列表表示通过。sources 为 {相对路径: 内容}。"""
    problems = []
    contract = sources['docs/V2/spec/00-契约冻结.md']
    engine = sources['mock_apis/engine.py']
    prompt = sources['chatflow/prompts/08-extract-vision.txt']
    inspector = sources['frontend/src/components/VisionInspector.tsx']

    a_block = section(contract, '契约 A')
    b_block = section(contract, '契约 B')
    a_fields = table_fields(a_block)
    b_fields = table_fields(b_block)
    if len(a_fields) < 5:
        problems.append(f'契约 A 只解析到 {len(a_fields)} 个字段（应 ≥ 5），表格可能被改坏')
    if len(b_fields) < 15:
        problems.append(f'契约 B 只解析到 {len(b_fields)} 个字段（应 ≥ 15），表格可能被改坏')

    # C1：后端产出的 state 键必须都在契约 B 里
    for key in sorted(engine_state_keys(engine) - set(b_fields)):
        problems.append(f'engine.py 产出了契约 B 未定义的 state 字段：{key}')

    # C2：契约 A 的字段必须在 extract 提示词里声明
    for field in a_fields:
        if field == 'vision':
            continue
        if f'"{field}"' not in prompt:
            problems.append(f'extract 提示词没有声明契约 A 的字段：{field}')

    # C3：现象枚举三端一致
    contract_enum = enum_of(a_block, 'fault_phenomenon')
    sets = engine_phenomenon_sets(engine)
    engine_enum = set().union(*sets.values()) | NEUTRAL_PHENOMENA
    if contract_enum != engine_enum:
        problems.append(
            '现象枚举不一致：契约独有 %s；engine 独有 %s'
            % (sorted(contract_enum - engine_enum) or '无', sorted(engine_enum - contract_enum) or '无'))
    for value in sorted(contract_enum):
        if f'`{value}`' not in prompt:
            problems.append(f'extract 提示词的现象表里缺少取值：{value}')

    # C4：安全类现象三端一致
    if sets.get('VISION_SAFETY') != frontend_safety_phenomena(inspector):
        problems.append(
            '安全类现象不一致：engine=%s 前端=%s'
            % (sorted(sets.get('VISION_SAFETY') or []), sorted(frontend_safety_phenomena(inspector))))

    # C5：视觉跳级阈值统一
    m = NUMBER.search(engine)
    if not m:
        problems.append('engine.py 里找不到视觉跳级阈值')
    else:
        raw = m.group(1)
        engine_threshold = float(('0' + raw) if raw.startswith('.') else raw)
        frontend_threshold = frontend_confidence_threshold(inspector)
        if abs(engine_threshold - frontend_threshold) > 1e-9:
            problems.append(f'置信度阈值不一致：engine={engine_threshold} 前端={frontend_threshold}')

    return problems


def main():
    try:
        problems = run_checks(load_sources())
    except ContractError as exc:
        print(f'契约检查无法执行：{exc}', file=sys.stderr)
        return 2
    if problems:
        print('契约不一致：', file=sys.stderr)
        for p in problems:
            print(f'  - {p}', file=sys.stderr)
        return 1
    print('契约检查通过：契约 A/B 字段、现象枚举、安全类分组、置信度阈值三端一致。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
