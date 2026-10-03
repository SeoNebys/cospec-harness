#!/usr/bin/env python3
"""Compare existing Judge outputs on fixed requirements; no model calls.

Writes only sibling analysis artifacts. Does not align or reclassify decisions.
"""
import hashlib
import json
import math
import runpy
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PREFIX = 'requirement-agreement'
CONDITIONS = ['VC', 'SD-S', 'CO-S', 'SD-D', 'CO-D']
JUDGES = ['claude', 'codex']
CORE = {f'REF-BM-{i:02d}' for i in range(1, 23)}
EXTENDED = {f'REF-BM-{i:02d}' for i in range(23, 33)}


def agreement(pairs, labels):
    """Cohen kappa; linear weighted kappa for ordered categories."""
    size = len(labels)
    index = {v: i for i, v in enumerate(labels)}
    matrix = [[0] * size for _ in labels]
    for a, b in pairs:
        matrix[index[a]][index[b]] += 1
    n = len(pairs)
    if not n:
        raise ValueError('Empty comparison')
    rows = [sum(row) for row in matrix]
    cols = [sum(row[j] for row in matrix) for j in range(size)]
    matched = sum(matrix[i][i] for i in range(size))
    expected = sum(rows[i] * cols[i] for i in range(size)) / n ** 2
    kappa = (matched / n - expected) / (1 - expected) if expected < 1 else None
    observed_distance = sum(abs(i-j) * matrix[i][j] for i in range(size) for j in range(size)) / n
    expected_distance = sum(abs(i-j) * rows[i] * cols[j] for i in range(size) for j in range(size)) / n ** 2
    weighted = 1 - observed_distance / expected_distance if expected_distance else None
    result = dict(n=n, matched=matched, agreement_pct=100 * matched/n,
                  labels=labels, matrix_rows_claude_columns_codex=matrix,
                  claude_counts=rows, codex_counts=cols,
                  expected_agreement_pct=100 * expected,
                  cohen_kappa=kappa, linear_weighted_kappa=weighted)
    if size == 2:
        both_no, both_yes = matrix[0][0], matrix[1][1]
        different = matrix[0][1] + matrix[1][0]
        result.update(
            positive_agreement_pct=100*2*both_yes/(2*both_yes+different) if 2*both_yes+different else None,
            negative_agreement_pct=100*2*both_no/(2*both_no+different) if 2*both_no+different else None)
    return result


def self_check():
    perfect = agreement([(0, 0), (1, 1)], [0, 1])
    assert perfect['cohen_kappa'] == perfect['linear_weighted_kappa'] == 1
    assert agreement([(0, 1), (1, 0)], [0, 1])['cohen_kappa'] == -1
    assert agreement([(1, 1)] * 3, [0, 1])['cohen_kappa'] is None
    half = agreement([(0, 0), (0, 1), (1, 0), (1, 1)], [0, 1])
    assert half['cohen_kappa'] == 0 and half['agreement_pct'] == 50
    ordinal = agreement([(0, 0), (1, 2), (2, 2)], [0, 1, 2])
    assert math.isclose(ordinal['cohen_kappa'], .5)
    assert math.isclose(ordinal['linear_weighted_kappa'], 2/3)


def fmt(value, digits=3):
    return '산출 불가' if value is None else f'{value:.{digits}f}'


def main():
    self_check()
    sources = {}

    def read(path):
        data = path.read_bytes()
        sources[str(path.relative_to(ROOT))] = hashlib.sha256(data).hexdigest()
        return json.loads(data)

    helper = HERE / 'co-construction-requirement-coverage.py'
    sources[str(helper.relative_to(ROOT))] = hashlib.sha256(helper.read_bytes()).hexdigest()
    measure = runpy.run_path(str(helper))['measure']
    state = read(ROOT / 'runs/execution-state.json')
    assert state['status'] == 'finished' and len(state['trials']) == 150
    assert Counter(t['condition'] for t in state['trials']) == Counter({c: 30 for c in CONDITIONS})
    pairs, decision_counts = [], Counter()
    seen = set()
    for trial in state['trials']:
        condition, run = trial['condition'], trial['run']
        assert trial['status'] == 'completed' and (condition, run) not in seen
        seen.add((condition, run))
        base = ROOT / 'runs' / condition / f'run-{run:02d}'
        data, refs = {}, {}
        for judge in JUDGES:
            data[judge] = read(base / 'judgments' / judge / 'judgment.json')
            for category, expected in [('core', CORE), ('extended', EXTENDED)]:
                assert set(data[judge][category]) == expected
                assert set(data[judge][category].values()) <= {'absent', 'partial', 'present'}
            ng = read(base / 'judgments' / judge / 'ng-judgment.json')
            _, trace = measure(ng)
            refs[judge] = set(trace['core_refs']) | set(trace['extended_refs'])
            decision_counts[judge] += len(ng['decisions'])
        for category, keys in [('core', CORE), ('extended', EXTENDED)]:
            for ref in sorted(keys):
                pairs.append(dict(trial_id=trial['trial_id'], condition=condition, run=run,
                                  category=category, requirement=ref,
                                  implementation={j: data[j][category][ref] for j in JUDGES},
                                  contribution={j: int(ref in refs[j]) for j in JUDGES}))
    assert len(pairs) == 4800
    summaries = []
    for condition in ['ALL'] + CONDITIONS:
        for category in ['ALL', 'core', 'extended']:
            selected = [r for r in pairs if (condition == 'ALL' or r['condition'] == condition)
                        and (category == 'ALL' or r['category'] == category)]
            for metric, labels in [('implementation', ['absent', 'partial', 'present']), ('contribution', [0, 1])]:
                result = agreement([(r[metric]['claude'], r[metric]['codex']) for r in selected], labels)
                summaries.append(dict(condition=condition, category=category, metric=metric, **result))
    # Ensure source bytes remained unchanged throughout the calculation.
    for rel, expected in sources.items():
        assert hashlib.sha256((ROOT / rel).read_bytes()).hexdigest() == expected, rel
    output = dict(unit='trial × reference requirement', trials=150, paired_requirements=4800,
                  decision_counts=dict(decision_counts), sources_sha256=sources,
                  summaries=summaries, pairs=pairs)
    (HERE / f'{PREFIX}.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    lines = [
        '# 기존 판정 자료의 요구사항 단위 일치도', '',
        '## 분석 범위와 방법', '',
        '- 150회 시행의 Claude·Codex 판정 결과를 사용하였다. Judge 재실행이나 원자료 수정은 하지 않았다.',
        '- 비교 단위는 동일 시행의 동일 참조 요구사항이다. 핵심 22개와 확장 10개로, 총 4,800쌍이다.',
        '- 구현 판정은 absent·partial·present의 정확 일치율과 Cohen의 κ를 계산하였다. 순서가 있는 세 범주이므로 선형 가중 κ도 함께 제시한다.',
        '- 공동 구축 인정 여부는 기존 커버리지 집계 함수를 그대로 사용하였다. corrective 또는 accepted_divergence 결정에 한 번 이상 연결된 요구사항은 1, 나머지는 0으로 두고 정확 일치율과 Cohen의 κ를 계산하였다.',
        '- 0은 해당 Judge의 기록에서 공동 구축으로 집계된 기여가 없다는 뜻이다. 기회가 없었거나 판단이 미해결인 경우도 포함하므로, 미인식 판정과 같지 않다.',
        '- 공동 구축 인정 여부의 긍정 일치율은 2×양쪽 인정/(2×양쪽 인정+불일치), 부정 일치율은 2×양쪽 미인정/(2×양쪽 미인정+불일치)이다.',
        '- κ는 관측된 일치율에서 각 Judge의 범주별 비율로 예상되는 우연 일치를 고려한 값이다. 같은 범주에 판정이 몰리면 단순 일치율이 높더라도 κ는 낮을 수 있다.',
        '- 전체 값은 모든 요구사항 쌍을 합쳐 계산하였다. 핵심 요구사항이 더 많으므로 전체 값에서 더 큰 비중을 차지한다.',
        '- 본 결과는 기술적 요약이며 유의확률이나 신뢰구간은 산출하지 않았다. 4,800쌍은 150개 시행에 묶인 자료이므로 서로 독립인 4,800개 시행으로 해석하지 않는다.', '',
        '## 구현 판정', '',
        '| 조건 | 요구사항 | 비교 쌍 | 일치율(%) | κ | 선형 가중 κ |',
        '| --- | --- | ---: | ---: | ---: | ---: |',
    ]
    names = {'ALL': '전체', 'core': '핵심', 'extended': '확장'}
    for s in summaries:
        if s['metric'] == 'implementation':
            lines.append(f"| {names.get(s['condition'], s['condition'])} | {names[s['category']]} | {s['n']} | {fmt(s['agreement_pct'], 2)} | {fmt(s['cohen_kappa'])} | {fmt(s['linear_weighted_kappa'])} |")
    lines += ['', '## 공동 구축 인정 여부', '',
              '| 조건 | 요구사항 | 비교 쌍 | 일치율(%) | κ | 긍정 일치율(%) | 부정 일치율(%) |',
              '| --- | --- | ---: | ---: | ---: | ---: | ---: |']
    for s in summaries:
        if s['metric'] == 'contribution':
            lines.append(f"| {names.get(s['condition'], s['condition'])} | {names[s['category']]} | {s['n']} | {fmt(s['agreement_pct'], 2)} | {fmt(s['cohen_kappa'])} | {fmt(s['positive_agreement_pct'], 2)} | {fmt(s['negative_agreement_pct'], 2)} |")
    lines += ['', '## 전체 혼동행렬', '', '행은 Claude, 열은 Codex 판정이다.', '']
    for s in summaries:
        if s['condition'] != 'ALL' or s['category'] != 'ALL':
            continue
        lines += [('구현 판정' if s['metric'] == 'implementation' else '공동 구축 인정 여부(0: 집계된 기여 없음, 1: 기여 있음)'), '',
                  '| Claude / Codex | ' + ' | '.join(map(str, s['labels'])) + ' |',
                  '| --- | ' + ' | '.join(['---:'] * len(s['labels'])) + ' |']
        for label, row in zip(s['labels'], s['matrix_rows_claude_columns_codex']):
            lines.append('| ' + str(label) + ' | ' + ' | '.join(map(str, row)) + ' |')
        lines.append('')
    impl = next(s for s in summaries if s['condition'] == s['category'] == 'ALL' and s['metric'] == 'implementation')
    contrib = next(s for s in summaries if s['condition'] == s['category'] == 'ALL' and s['metric'] == 'contribution')
    lines += ['## 결과 요약', '',
              f"구현 판정은 4,800쌍 중 {impl['matched']:,}쌍에서 일치하였다({fmt(impl['agreement_pct'], 2)}%). 공동 구축 인정 여부는 {contrib['matched']:,}쌍에서 일치하였다({fmt(contrib['agreement_pct'], 2)}%). 공동 구축의 긍정 일치율도 {fmt(contrib['positive_agreement_pct'], 2)}%로, 전체 일치가 양쪽 모두 기여를 인정하지 않은 사례에서만 발생한 것은 아니다.", '',
              '두 Judge가 기록한 전체 결정 수에는 차이가 있지만, 요구사항별로 구현 상태를 판단하거나 공동 구축 기여를 인정한 결과는 상당 부분 일치한다. 다만 요구사항 단위로 묶는 과정에서 결정 수와 세부 분류의 차이는 드러나지 않으므로, 이 결과로 개별 결정의 일치도까지 판단할 수는 없다.', '',
              '## 해석 범위', '',
              '- 공동 구축 결과는 어떤 요구사항에서 기여를 인정했는지에 대한 일치도이다. 개별 결정의 분할, 응답 유형, 공동 구축 횟수 N_g의 일치도를 측정한 것은 아니다.',
              '- 같은 요구사항에 대해 두 Judge가 서로 다른 대화를 근거로 기여를 인정한 경우에도 1–1로 집계된다. 또한 한쪽에만 기록된 결정은 별도의 결측 판정으로 보충하지 않았다.',
              '- 판정이 일치한다는 사실만으로 정확성을 보장하지 않는다. 인간 판정 또는 독립적인 정답과의 대조는 수행하지 않았다.', '',
              '## 재현', '',
              '`python3 analysis/requirement-agreement.py`', '',
              '`requirement-agreement.json`에 전체 요구사항별 비교 자료, 혼동행렬, 집계 결과 및 입력 파일 SHA-256을 보존하였다. 원고는 수정하지 않았다.', '']
    (HERE / f'{PREFIX}.md').write_text('\n'.join(lines))
    print(json.dumps([s for s in summaries if s['condition'] == 'ALL'], ensure_ascii=False, indent=2))
    print(f'Validated {len(sources)} inputs; wrote {PREFIX}.json and {PREFIX}.md')


if __name__ == '__main__':
    main()
