#!/usr/bin/env python3
"""Exact, design-restricted permutation analysis of frozen co-construction data.

Run from any directory with Python 3.10+. Uses only the standard library.
Writes analysis artifacts beside this script; never modifies experiment evidence.
"""
import argparse
import csv
import hashlib
import itertools
import json
import random
import statistics
from collections import Counter
from fractions import Fraction
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
INPUT = HERE / 'final-results-20260928-runs.csv'
INPUT_SHA = 'f76e459e83e5a6d26f178cab9c9f1cfe916972be4b2988082d8637ef46566ed6'
PREFIX = 'r3-5-analysis'
CONTRASTS = [('C1', 'CO-D', 'CO-S'), ('C2', 'SD-D', 'SD-S'),
             ('C3', 'CO-S', 'SD-S'), ('C4', 'CO-D', 'SD-D')]
JUDGES = ['claude', 'codex']
METRICS = [('core', 22, '핵심'), ('extended', 10, '확장')]
PAIR_KEYS = ['block', 'maker', 'director', 'maker_effort']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sign_distribution(differences):
    """Count ALL label swaps, including multiplicity from zero differences."""
    distribution = Counter({0: 1})
    for delta in differences:
        following = Counter()
        for total, count in distribution.items():
            following[total + delta] += count
            following[total - delta] += count
        distribution = following
    require(sum(distribution.values()) == 2 ** len(differences), 'Permutation mass')
    return distribution


def exact_test(differences):
    require(bool(differences), 'Empty comparison')
    observed = abs(sum(differences))
    distribution = sign_distribution(differences)
    extreme = sum(count for value, count in distribution.items() if abs(value) >= observed)
    total = 2 ** len(differences)
    return Fraction(extreme, total), extreme, total


def holm(pvalues):
    order = sorted(range(len(pvalues)), key=pvalues.__getitem__)
    adjusted = [Fraction(0)] * len(pvalues)
    running = Fraction(0)
    for rank, index in enumerate(order):
        running = max(running, (len(pvalues) - rank) * pvalues[index])
        adjusted[index] = min(Fraction(1), running)
    return adjusted


def self_check():
    # Independent enumeration is tractable here and exercises signed values,
    # repeated values, cancellation, zero pairs and inclusive two-sided tails.
    cases = 0
    for n in range(1, 5):
        for values in itertools.product(range(-2, 3), repeat=n):
            direct = Counter(sum(x * s for x, s in zip(values, signs))
                             for signs in itertools.product([-1, 1], repeat=n))
            require(sign_distribution(values) == direct, f'DP mismatch: {values}')
            p, extreme, total = exact_test(values)
            require(p == Fraction(sum(c for v, c in direct.items()
                                      if abs(v) >= abs(sum(values))), 2 ** n), 'Tail mismatch')
            require(exact_test(tuple(-v for v in values))[0] == p, 'Direction mismatch')
            cases += 1
    require(exact_test([0] * 30)[0] == 1, 'All-zero test')
    require(exact_test([1] * 30)[0] == Fraction(2, 2 ** 30), 'Extreme-tail test')
    ps = list(map(Fraction, ['0.01', '0.04', '0.03', '0.002']))
    expected = list(map(Fraction, ['0.03', '0.06', '0.06', '0.008']))
    require(holm(ps) == expected, 'Holm example')
    for order in itertools.permutations(range(4)):
        require(holm([ps[i] for i in order]) == [expected[i] for i in order], 'Holm ordering')
    require(holm([Fraction(0), Fraction(1, 10), Fraction(1, 10), Fraction(1)]) ==
            [Fraction(0), Fraction(3, 10), Fraction(3, 10), Fraction(1)], 'Holm ties')
    return {'exhaustive_small_examples': cases, 'holm_orderings': 24,
            'zero_ties_reversal_and_extreme_tail': 'passed'}


def read_csv(path):
    with path.open(newline='', encoding='utf-8') as handle:
        return list(csv.DictReader(handle))


def validate():
    require(sha(INPUT) == INPUT_SHA, 'Frozen input hash changed')
    evidence_path = HERE / 'final-results-20260928-evidence.json'
    evidence = json.loads(evidence_path.read_text())
    sources = evidence['source_sha256']
    for name, digest in sources.items():
        path = ROOT / name
        require(path.is_file() and sha(path) == digest, f'Evidence changed: {name}')
    rows = read_csv(INPUT)
    require(len(rows) == 300 and len({(r['trial_id'], r['judge']) for r in rows}) == 300,
            'Expected 300 unique trial/Judge rows')
    state_path = ROOT / 'runs/execution-state.json'
    state = json.loads(state_path.read_text())
    trials = {t['trial_id']: t for t in state['trials']}
    require(state['status'] == 'finished' and len(trials) == 150, 'Unfinished experiment')
    require(all(t['status'] == 'completed' and t['summary']['terminated'] == 'accepted'
                for t in trials.values()), 'Incomplete trial')
    schedule_path = ROOT / 'config/trial-schedule.csv'
    schedule = read_csv(schedule_path)
    combinations = [(m, d, e, c) for m, d in [('claude', 'codex'), ('codex', 'claude')]
                    for e in ['low', 'medium', 'high']
                    for c in ['VC', 'SD-S', 'SD-D', 'CO-S', 'CO-D']]
    rng = random.Random(42)
    expected = []
    for block in range(1, 6):
        shuffled = list(combinations)
        rng.shuffle(shuffled)
        expected.extend((str(block), *combo) for combo in shuffled)
    require(expected == [(r['block'], r['maker'], r['director'], r['maker_effort'], r['condition'])
                         for r in schedule], 'Schedule differs from frozen randomized design')
    by_id = {r['trial_id']: r for r in schedule}
    counts = Counter()
    cells = Counter()
    for row in rows:
        tid = row['trial_id']
        for key in PAIR_KEYS + ['condition', 'director_effort']:
            require(row[key] == by_id[tid][key] == str(trials[tid][key]), f'Metadata: {tid}/{key}')
        require(row['run'] == str(trials[tid]['run']), f'Run number: {tid}')
        require(row['judge'] in JUDGES and row['director_effort'] == 'medium', 'Role configuration')
        counts[row['condition'], row['judge']] += 1
        cells[tuple(row[k] for k in PAIR_KEYS + ['condition', 'judge'])] += 1
        for metric, denominator, _ in METRICS:
            count = int(row[f'{metric}_items'])
            require(int(row[f'{metric}_denominator']) == denominator, 'Denominator mismatch')
            require(0 <= count <= denominator, 'Requirement count outside bounds')
            require(abs(float(row[f'{metric}_coverage_pct']) - count * 100 / denominator) < 1e-9,
                    f'Coverage mismatch: {tid}/{metric}')
    require(len(counts) == 10 and set(counts.values()) == {30}, 'Unbalanced conditions')
    require(len(cells) == 300 and set(cells.values()) == {1}, 'Unbalanced design cells')
    hashes = {str(p.relative_to(ROOT)): sha(p) for p in
              [INPUT, evidence_path, state_path, schedule_path,
               HERE / 'r3-5-analysis-plan.md', Path(__file__)]}
    return rows, {'input_hashes': hashes, 'verified_source_files': len(sources),
                  'unique_trials': len(trials), 'judge_rows': len(rows),
                  'schedule_reproduced': True}


def analyze(rows):
    index = {(r['condition'], r['judge'], tuple(r[k] for k in PAIR_KEYS)): r for r in rows}
    keys = sorted({tuple(r[k] for k in PAIR_KEYS) for r in rows})
    require(len(keys) == 30, 'Expected 30 matched design cells')
    results, pairs, pvalues = [], [], []
    for contrast, a, b in CONTRASTS:
        for metric, denominator, _ in METRICS:
            for judge in JUDGES:
                a_values, b_values, differences = [], [], []
                for key in keys:
                    left, right = index[a, judge, key], index[b, judge, key]
                    x, y = int(left[f'{metric}_items']), int(right[f'{metric}_items'])
                    differences.append(x - y)
                    a_values.append(x * 100 / denominator)
                    b_values.append(y * 100 / denominator)
                    pairs.append(dict(contrast=contrast, condition_a=a, condition_b=b,
                        metric=metric, judge=judge, **dict(zip(PAIR_KEYS, key)),
                        trial_a=left['trial_id'], trial_b=right['trial_id'],
                        count_a=x, count_b=y, denominator=denominator,
                        difference_items=x-y, difference_pp=(x-y)*100/denominator))
                p, extreme, total = exact_test(differences)
                difference = statistics.mean(differences) * 100 / denominator
                require(abs(difference - (statistics.mean(a_values) - statistics.mean(b_values))) < 1e-9,
                        'Effect not equal to balanced marginal difference')
                results.append(dict(contrast=contrast, condition_a=a, condition_b=b,
                    metric=metric, judge=judge, n_pairs=len(keys),
                    mean_a=statistics.mean(a_values), sd_a=statistics.stdev(a_values),
                    mean_b=statistics.mean(b_values), sd_b=statistics.stdev(b_values),
                    difference_pp=difference, positive_pairs=sum(d>0 for d in differences),
                    zero_pairs=differences.count(0), negative_pairs=sum(d<0 for d in differences),
                    extreme_assignments=extreme, total_assignments=total,
                    p_exact_fraction=str(p), p_raw=float(p)))
                pvalues.append(p)
    require(len(results) == 16 and len(pairs) == 480, 'Output size mismatch')
    for row, adjusted in zip(results, holm(pvalues)):
        row.update(p_holm_fraction=str(adjusted), p_holm=float(adjusted),
                   significant_holm_005=adjusted <= Fraction(1, 20))
    return results, pairs


def write_csv(path, rows):
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def pformat(value):
    return f'{value:.3g}'


def report(results):
    lines = ['# R3-5 탐색적 통계 검정 결과', '',
        '기존 150회 시행 중 계획한 네 비교에 해당하는 시행을 분석하였다. '
        '두 Judge를 따로 분석하고, 핵심·확장 커버리지를 구분하였다. '
        '각 비교는 조건별 30회 시행으로 이루어진다. VC의 기존 데이터는 유지하며 이번 검정에는 포함하지 않았다.', '',
        '## 분석 방법', '',
        '같은 실행 묶음·Maker·Director·Maker 추론 수준의 시행을 연결한 30쌍 안에서만 조건 라벨을 교환하였다. '
        '평균 커버리지 차이를 통계량으로 사용한 양측 정확 순열검정이며, '
        '2^30개 배정을 정수 차이 합의 분포로 계산하였다. '
        '16개 검정 전체에 Holm 보정을 적용하였다. 차이의 단위는 퍼센트포인트(pp)이며 A−B 방향이다.', '',
        '이는 동일 세션의 반복 측정이 아니라 무작위 실행 설계의 설정과 묶음을 맞춘 비교이다. '
        '귀무가설 하에서 쌍 내부의 조건 배정을 교환할 수 있고 시행 간 간섭이 없다는 가정에 의존한다. '
        '기존 결과를 확인한 뒤 수행한 탐색적 분석이며, 인간이나 다른 과제에 대한 일반화 검정은 아니다.', '',
        '## 전체 결과', '',
        '| 비교(A−B) | 범주 | Judge | A 평균 ± SD (%) | B 평균 ± SD (%) | 차이(pp) | 원래 p | Holm p | 보정 후 p≤.05 |',
        '|---|---|---|---:|---:|---:|---:|---:|---|']
    for r in results:
        metric = '핵심' if r['metric'] == 'core' else '확장'
        lines.append(f"| {r['condition_a']} − {r['condition_b']} | {metric} | {r['judge']} | "
                     f"{r['mean_a']:.2f} ± {r['sd_a']:.2f} | {r['mean_b']:.2f} ± {r['sd_b']:.2f} | "
                     f"{r['difference_pp']:+.2f} | {pformat(r['p_raw'])} | {pformat(r['p_holm'])} | "
                     f"{'예' if r['significant_holm_005'] else '아니오'} |")
    lines += ['', '정확한 p값의 분수와 모든 유효 숫자는 결과 CSV에 저장하였다. '
              'p값이 표시 자릿수에서 작더라도 0으로 표기하지 않았다.', '', '## 비교별 요약', '']
    for contrast, a, b in CONTRASTS:
        subset = [r for r in results if r['contrast'] == contrast]
        significant = sum(r['significant_holm_005'] for r in subset)
        direction = '양수' if all(r['difference_pp'] > 0 for r in subset) else (
            '음수' if all(r['difference_pp'] < 0 for r in subset) else '혼합')
        lines.append(f'- {a} − {b}: 두 Judge·두 범주의 차이는 {direction}이며, '
                     f'4개 검정 중 {significant}개가 전체 16개에 대한 Holm 보정 후 p≤.05이다.')
    lines += ['', '## 현재 원고 해석과의 관계', '',
        '참여 태도에 관한 C1·C2의 결과는 두 방법 모두 성실한 참여 조건에서 공동 구축 요구사항의 '
        '범위가 더 넓게 관찰되었다는 4.3절·5.1절의 해석을 보완한다. '
        '다만 이 지표의 검정만으로 참여 태도 지침을 정확히 준수했는지까지 판정할 수는 없다. '
        '지침 준수에 관한 해석은 차이 인식 및 대응 양상과 함께 제시해야 한다.', '',
        '방법 간 차이는 C3·C4의 평균 차이와 보정 p값을 함께 보고한다. '
        '평균 커버리지가 더 높거나 낮았다는 기술적 관찰과, 보정 후 통계적으로 유의한 차이를 구분한다. '
        '유의성이 일부 Judge·범주에만 나타나면 해당 범위를 명시한다. '
        '이 결과로 COSPEC과 SDD의 동등성 또는 전반적 우열을 주장하지 않는다. '
        '상호작용 사례에서 관찰한 공동 구축 절차의 작동 가능성은 방법 간 차이의 유의성과 구별하여 논의한다.', '',
        '초록과 결론의 평균 차이에 관한 문구를 자동으로 삭제할 필요는 없지만, '
        '관찰된 차이를 보편적인 성능 우위로 읽히게 하는 표현은 피한다. '
        '공동 구축 횟수와 구현 커버리지는 이번 검정 대상이 아니므로, 해당 지표에 이 p값을 적용하지 않는다.', '',
        '## 해석 범위', '',
        '- p값은 평균 차이의 크기를 대신하지 않는다. 차이의 방향·크기와 기존 시행별 분포를 함께 해석한다.',
        '- 유의하지 않은 결과는 두 조건의 동등성을 입증하지 않는다.',
        '- 두 Judge는 같은 시행을 평가했으므로 두 독립 실험의 재현으로 해석하지 않는다.',
        '- 공동 구축 횟수·차이 인식률·구현 커버리지·텍스트량·VC·추론 수준 간 차이에 대한 검정은 수행하지 않았다.',
        '- 이 검정만으로 촉진 매체와 절차의 효과를 분리하거나, 역할의 기여에 대한 인과 기제를 입증할 수는 없다.',
        '- 방법별 D−S 검정의 유의성만 비교하여 참여 태도 효과가 어느 방법에서 더 크다고 판단하지 않는다. '
        '그러한 주장은 별도의 상호작용 검정이 필요하며 이번 계획에는 포함하지 않았다.', '',
        '## 재현 및 검증', '',
        '실행: `python3 analysis/r3-5-analysis.py`', '',
        '자체 검증만 실행: `python3 analysis/r3-5-analysis.py --self-test`', '',
        '- 입력과 원천 파일의 해시, 실행 상태, 설계별 균형, 요구사항 수와 커버리지의 대응을 확인하였다.',
        '- 작은 정수 예시 780개에서 직접 전수 열거와 동적 계획법의 전체 분포가 일치하였다.',
        '- 영차이·동률·방향 반전·극단 꼬리 확률과 Holm 보정의 순서 불변성을 확인하였다.',
        '- 결과 CSV는 16개 행, 시행 연결 CSV는 480개 행이다. 연결 행은 재사용되는 시행의 추적 자료이며 독립 표본 수가 아니다.',
        '- 실행 증거 JSON에 입력·계획·스크립트·출력 해시를 저장한다. 검정에는 난수를 사용하지 않는다.', '',
        '원고와 심사 대응 현황은 아직 수정하지 않았다. 해석 검토 후 원고 수정안을 별도로 제시한다.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    checks = self_check()
    if args.self_test:
        print(json.dumps(checks, indent=2))
        return
    rows, evidence = validate()
    results, pairs = analyze(rows)
    # Recheck immutable inputs before writing output.
    for name, digest in evidence['input_hashes'].items():
        require(sha(ROOT / name) == digest, f'Input changed during analysis: {name}')
    outputs = [HERE / f'{PREFIX}-results.csv', HERE / f'{PREFIX}-pairs.csv',
               HERE / f'{PREFIX}-results.md']
    write_csv(outputs[0], results)
    write_csv(outputs[1], pairs)
    outputs[2].write_text(report(results), encoding='utf-8')
    evidence.update(self_checks=checks, tests=16, comparison_pairs_per_test=30,
                    correction='Holm across all 16 tests', alpha=0.05,
                    permutation='exact within-design-cell A/B label swaps; two-sided absolute mean',
                    output_sha256={str(p.relative_to(ROOT)): sha(p) for p in outputs})
    (HERE / f'{PREFIX}-evidence.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2)+'\n')
    print(outputs[2].read_text())


if __name__ == '__main__':
    main()
