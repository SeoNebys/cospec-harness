#!/usr/bin/env python3
"""Summarize the frozen 150 trials without modifying experiment evidence."""
import collections
import csv
import hashlib
import json
import runpy
import statistics as st
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
EXP = ROOT
PREFIX = 'final-results-20260928'
CONDS = ['VC', 'SD-S', 'CO-S', 'SD-D', 'CO-D']
JUDGES = ['claude', 'codex']
EFFORTS = ['low', 'medium', 'high']
CORE = {f'REF-BM-{i:02}' for i in range(1, 23)}
EXT = {f'REF-BM-{i:02}' for i in range(23, 33)}
TOKENS = ['input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens',
          'output_tokens', 'reasoning_output_tokens']
FIELDS = ['core_coverage_pct', 'extended_coverage_pct', 'implementation_core',
          'implementation_extended', 'n_g', 'n_c', 'n_a', 'n_m',
          'recognition_pct', 'unresolved', 'excluded', 'responses', 'input_chars',
          'throughput', 'chunk_median', 'chunk_max', 'execution_minutes']
sources = {}


def read(path):
    data = path.read_bytes()
    sources[str(path.relative_to(ROOT))] = hashlib.sha256(data).hexdigest()
    return json.loads(data)


def stats(values):
    v = [x for x in values if x is not None]
    return dict(n=len(v), mean=st.mean(v) if v else None,
                sd=st.stdev(v) if len(v) > 1 else None,
                median=st.median(v) if v else None,
                min=min(v) if v else None, max=max(v) if v else None)


def csv_write(suffix, rows):
    with (HERE / f'{PREFIX}-{suffix}.csv').open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def main():
    state = read(EXP / 'runs/execution-state.json')
    assert state['status'] == 'finished'
    assert set(state['required_judges']) == set(JUDGES)
    assert len(state['trials']) == 150
    assert all(b['status'] == 'judged' for b in state['blocks'].values())
    combos = collections.Counter((t['condition'], t['maker'], t['director'],
                                  t['maker_effort']) for t in state['trials'])
    assert len(combos) == 30 and set(combos.values()) == {5}
    resource = read(EXP / 'runs/resource-usage.json')
    resource_rows = {t['trial_id']: t for t in resource['trials']}
    assert len(resource_rows) == 150
    helper = HERE / 'co-construction-requirement-coverage.py'
    sources[str(helper.relative_to(ROOT))] = hashlib.sha256(helper.read_bytes()).hexdigest()
    measure = runpy.run_path(str(helper))['measure']
    rows, trial_rows, attempts = [], [], []
    traces, coverage = {}, {}
    trial_tokens = collections.defaultdict(collections.Counter)
    incomplete_usage, recoveries = [], []
    for t in state['trials']:
        assert t['status'] == 'completed' and t['summary']['terminated'] == 'accepted'
        assert not t['summary']['hit_max_rounds']
        p = EXP / 'runs' / t['condition'] / f"run-{t['run']:02}"
        meta = read(p / 'meta.json')
        read(p / 'archive-complete.json')
        assert meta['trial']['trial_id'] == t['trial_id']
        assert meta['models'] == t['models']
        for k, v in meta['trial'].items():
            assert t[k] == v, (t['trial_id'], k)
        log = read(p / 'broker-log.json')
        client = [e for e in log if e.get('role') == 'client']
        maker = [e for e in log if e.get('role') == 'maker']
        docs = {}
        if t['condition'].startswith('SD-'):
            for d in (p / 'presentation').glob('round-*'):
                n = 0
                for f in d.glob('*.md'):
                    sources[str(f.relative_to(ROOT))] = hashlib.sha256(f.read_bytes()).hexdigest()
                    n += len(f.read_text())
                docs[int(d.name.split('-')[1])] = n
        chunks = [e['chars'] + docs.get(e['round'], 0) for e in maker]
        res = resource_rows[t['trial_id']]
        assert res['status'] == 'completed' and res['run'] == t['run']
        common = {k: t[k] for k in ['trial_id', 'block', 'condition', 'maker',
                                    'director', 'maker_effort', 'director_effort', 'run']}
        common.update(responses=len(client), input_chars=sum(e['chars'] for e in client),
                      throughput=sum(chunks), chunk_median=st.median(chunks),
                      chunk_max=max(chunks), rounds=t['summary']['rounds'],
                      execution_minutes=res['execution_seconds'] / 60,
                      elapsed_seconds=res['elapsed_seconds'],
                      interruption_seconds=res['interruption_seconds'])
        assert len(client) == t['summary']['rounds'] == len(maker)
        trial_rows.append(common)
        if t.get('recovery'):
            recoveries.append(dict(trial_id=t['trial_id'], condition=t['condition'],
                                   **t['recovery']))
        if not res['resources']['usage_complete']:
            incomplete_usage.append(t['trial_id'])
        for role, u in res['resources']['roles'].items():
            for key in TOKENS:
                trial_tokens[(u['provider'], role)][key] += u['usage'].get(key, 0)
        for j in JUDGES:
            js = {}
            for mode, filename in [('coverage', 'judgment.json'),
                                   ('co-construction', 'ng-judgment.json')]:
                f = p / 'judgments' / j / filename
                data = read(f)
                record = t['judgments'][f'{j}/{mode}']
                assert record['status'] == 'completed'
                assert record['sha256'] == sources[str(f.relative_to(ROOT))]
                assert data['_execution'] == dict(model=state['judges'][j], image_id=state['image_id'])
                js[mode] = data
                for af in (p / 'judgments' / j / f'{mode}-calls' / 'attempts').glob('*.json'):
                    a = read(af)
                    ac = a.get('accounting', {})
                    attempts.append(dict(trial_id=t['trial_id'], judge=j, mode=mode,
                        attempt_id=a['id'], outcome=a.get('outcome'),
                        seconds=a.get('elapsed_seconds', 0),
                        complete=ac.get('complete', False),
                        **{k: ac.get('usage', {}).get(k, 0) for k in TOKENS}))
            m, trace = measure(js['co-construction'])
            row = common | m | dict(judge=j,
                recognition_pct=None if m['capture_rate'] is None else 100 * m['capture_rate'],
                unresolved=sum(d['response_class'] == 'unresolved' for d in js['co-construction']['decisions']),
                excluded=len(js['co-construction'].get('excluded_decisions', [])))
            for group, refs in [('core', CORE), ('extended', EXT)]:
                values = js['coverage'][group]
                assert set(values) == refs
                assert set(values.values()) <= {'present', 'partial', 'absent'}
                row[f'implementation_{group}'] = 100 * sum(
                    {'present': 1, 'partial': .5, 'absent': 0}[v] for v in values.values()) / len(refs)
            rows.append(row)
            traces[t['trial_id'] + '/' + j] = {k: trace[k] for k in
                ['core_refs', 'extended_refs', 'corrective_refs', 'accepted_divergence_refs']}
            coverage[t['trial_id'] + '/' + j] = {k: js['coverage'][k] for k in ['core', 'extended']}
    assert len(rows) == 300
    assert len({r['trial_id'] for r in trial_rows}) == 150
    summaries = []
    group_specs = {
        'condition': ['condition', 'judge'],
        'effort': ['condition', 'maker_effort', 'judge'],
        'pair': ['condition', 'maker', 'director', 'judge'],
        'combination': ['condition', 'maker', 'director', 'maker_effort', 'judge'],
        'block': ['block', 'condition', 'judge'],
    }
    for scope, keys in group_specs.items():
        groups = collections.defaultdict(list)
        for row in rows:
            groups[tuple(row[k] for k in keys)].append(row)
        for values, rs in sorted(groups.items()):
            identity = dict(zip(keys, values))
            for metric in FIELDS:
                summaries.append(dict(scope=scope, condition=identity['condition'],
                    judge=identity['judge'], block=identity.get('block', ''),
                    maker=identity.get('maker', ''), director=identity.get('director', ''),
                    maker_effort=identity.get('maker_effort', ''), metric=metric,
                    **stats([r[metric] for r in rs])))
    # Reproduce the previously published 120-run reaggregation before extending it.
    old = list(csv.DictReader((HERE / 'additional-results-blocks-03-04-20260926-runs.csv').open()))
    lookup = {(r['trial_id'], r['judge']): r for r in rows}
    comparisons = 0
    for o in old:
        n = lookup[o['trial_id'], o['judge']]
        for key in ['core_coverage_pct', 'extended_coverage_pct', 'n_g', 'capture_rate']:
            if o.get(key) not in (None, ''):
                assert abs(float(o[key]) - n[key]) < 1e-8, (o['trial_id'], key)
                comparisons += 1
    csv_write('runs', rows)
    csv_write('trials', trial_rows)
    csv_write('summary', summaries)
    csv_write('judge-attempts', attempts)
    audit = dict(state_updated_at=state['updated_at'], trials=150, judgments=600,
        conditions=5, combinations=30, repetitions_per_combination=5, required_judges=JUDGES,
        models={j: state['judges'][j] for j in JUDGES}, source_sha256=sources, requirements_by_trial=traces,
        recoveries=recoveries, incomplete_trial_usage=incomplete_usage,
        prior_value_comparisons=comparisons,
        trial_tokens=[dict(provider=p, role=r, **u) for (p, r), u in trial_tokens.items()],
        resource_generated_at=resource['generated_at'])
    # Source records must remain identical throughout the aggregation.
    for path, sha in sources.items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == sha, path
    (HERE / f'{PREFIX}-evidence.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2))
    report(rows, trial_rows, attempts, audit)
    print(f'Validated 150 accepted trials, 600 required judgments, {comparisons} prior values.')
    for c in CONDS:
        for j in JUDGES:
            rs = [r for r in rows if r['condition'] == c and r['judge'] == j]
            print(c, j, {k: round(st.mean(r[k] for r in rs), 3) for k in FIELDS[:9]})


def report(rows, trials, attempts, audit):
    lines = ['# 최종 실험 결과: 150회', '',
        '집계일: 2026-09-28. 실행 상태 최종 갱신: ' + audit['state_updated_at'] + '.', '',
        '## 분석 대상과 집계 기준', '',
        '- 5조건 × 두 교차 모델 조합 × Maker 추론 수준 3개 × 반복 5회 = 150회. 조건별 30회, 조건·추론 수준별 10회, 개별 모델 조합·추론 수준·조건별 5회이다.',
        '- Maker/Director는 Claude Opus 4.8와 Codex gpt-5.6-sol을 교차 배정했다. Director 추론 수준은 중간, Judge 추론 수준은 높음이다.',
        '- 전체 150회가 Director의 최종 승인으로 종료되었다. Claude·Codex의 커버리지 및 공동 구축 판정 600건을 사용했다. 초기에 남은 Gemini 판정 3건과 실패 기록 1건은 포함하지 않았다.',
        '- 최종 승인은 참조 명세 전체의 구현이나 중간 오류 부재를 뜻하지 않는다. 기록상 복구 이력이 있는 시행은 아래 운영 기록에 별도로 명시했다.',
        '- 표의 ±는 시행 간 표본 표준편차이다. Judge별로 구분하며, 두 Judge를 합쳐 독립 시행 수를 늘리지 않는다.',
        '- 공동 구축 요구사항 커버리지는 수정 기여 또는 차이 수용에 연결된 고유 요구사항의 비율이다. 핵심 22개·확장 10개를 분리하고 중복 기여는 한 번만 센다. 기존 판정 분류와 참조 항목 연결은 변경하지 않았다.',
        '- 구현 커버리지는 present=1, partial=0.5, absent=0으로 계산했다. 시행별 중간 반올림 없이 집계했다.',
        '- 차이 인식률은 시행별 N_g/(N_g+N_m)의 평균이다. N_g=N_c+N_a이며, 미결정은 분모에서 제외한다. 분모가 0이면 결측으로 처리한다.',
        '- 텍스트량은 전달된 Maker 메시지와 SDD의 매 라운드 명세·계획 문서 전체를 포함한다. 이미지·프로토타입 자체와 실제 열람량은 측정하지 않는다.',
        '- 새 Judge 호출이나 추론통계는 수행하지 않았다. 원고와 실험 저장소는 수정하지 않았다.', '',
        '## 결과 해석과 원고 반영 방향', '',
        '### 연구 질문과의 연결', '',
        '기존에 확인한 대화→수정 요청·수용→시나리오·GWT→구현 사례와 함께 보면, 최종 결과는 COSPEC에서 반복적인 응답을 통한 요구사항 공동 구축이 가능함을 뒷받침한다. CO-S는 두 Judge 모두 30회 중 29회, CO-D는 30회 전부에서 공동 구축으로 판정된 결정이 나타났다. 따라서 일부 긍정 사례에만 의존하는 결과는 아니다. 다만 이는 참조 명세를 보유한 LLM Director 환경에서 관찰된 결과이며, 실제 인간의 지속적인 참여나 노력 감소를 직접 검증한 것은 아니다.', '',
        '### 만족화와 성실함에 따른 비교', '',
        '만족화 조건에서는 CO-S의 공동 구축 횟수, 핵심·확장 공동 구축 요구사항 커버리지, 핵심·확장 구현 커버리지가 두 Judge 모두 VC와 SD-S보다 높았다. 기존 60회에서는 VC와 CO-S의 순서가 지표·Judge에 따라 달랐지만, 최종 150회 평균에서는 CO-S가 앞선다. 이는 만족화 태도의 Director에게도 COSPEC의 반복적인 제시와 응답 절차가 기여를 드러낼 기회를 제공했다는 해석과 부합한다. 통계적 우월성이나 모든 시행에서의 우월성을 의미하지 않는다.', '',
        '성실함 조건에서는 CO-D의 평균 공동 구축 횟수가 SD-D보다 많지만, 고유 요구사항으로 집계한 공동 구축 범위와 구현 커버리지는 SD-D가 높다. 공동 구축 횟수의 증가는 더 많은 요구사항을 포괄했다는 뜻이 아니다. 한 요구사항에 여러 결정이 연결될 수 있으므로, 횟수만으로 깊이나 품질이 높다고 판단하지 않는다. 두 방법 모두 성실함 조건에서 만족화보다 공동 구축 범위·구현 커버리지·차이 인식률이 높아, 참여 태도에 따른 응답 양상과 결과 차이가 관찰되었다. 차이 인식률만으로 모든 지침의 준수를 검증했다고 서술하지 않는다.', '',
        '### 상호작용 방식과 비용', '',
        'COSPEC은 더 적은 텍스트를 제시하면서 더 자주 응답하도록 하는 형태를 유지한다. CO-S/CO-D의 평균 응답 수는 28.23/36.20회, SD-S/SD-D는 4.43/6.73회이다. 반면 Director의 누적 입력 문자 수와 시행 실행 시간은 COSPEC이 더 크다. 따라서 적은 제시 텍스트를 전체 노력 감소나 전반적인 효율 향상으로 바꿔 표현하지 않는다. SDD는 더 적은 응답·입력 문자로 기여를 드러냈고, 성실함 조건에서는 더 넓은 요구사항 범위에 기여했다. 이들 관측량은 인간의 인지 부하를 측정한 값이 아니다.', '',
        '### Maker 추론 수준과 모델 조합', '',
        'Maker 추론 수준의 효과는 일관된 증가 형태가 아니다. CO-S의 공동 구축 핵심·확장 커버리지는 중간에서 가장 높다. CO-D의 핵심 공동 구축 커버리지는 높음에서 가장 높지만, 확장 커버리지는 낮음에서 가장 높다. 구현 커버리지 역시 같은 순서를 따르지 않는다. 따라서 기존 원고의 “추론 수준이 높을수록 명세가 충분해졌다”는 일반적인 해석은 유지할 수 없다. “추론 수준별 차이가 관찰되었으나 방향은 참여 태도와 요구사항 범주에 따라 달랐다”로 정리하는 것이 적절하다.', '',
        '모델 조합 차이는 크다. 성실함 조건에서 Claude Maker·Codex Director 조합의 핵심 구현 커버리지는 SD-D 99.09/97.12%, CO-D 99.09/98.18%(Claude/Codex Judge)인 반면, 반대 조합에서는 각각 87.27/83.64%, 73.94/71.97%이다. 전체 평균만으로 촉진자의 추론 능력이나 Director의 보정 능력을 단독 원인으로 지목하기 어렵다. 두 역할의 모델이 함께 바뀌었고 Director 추론 수준은 고정되어 있으므로, 역할별 모델 효과를 분리한 실험으로 해석하지 않는다.', '',
        '### 최종 원고 갱신 대상', '',
        '- 3장: 최종 시행 수 150회, 조합별 5회, 조건별 30회와 실제 포함 Judge(Claude·Codex)를 명시하고 Gemini 제외 경위를 설명한다.',
        '- 4장: 60회 기준 표 9 이후의 수치·표준편차·범위·긍정 기여 시행 수를 교체한다. 기존 대화·GWT 사례는 해당 시행이 최종 집계에 포함되어 있으므로 사례 자체를 교체할 필요는 없다.',
        '- 4·5·6장: CO-S와 VC의 비교 및 추론 수준 해석을 최종 결과에 맞춘다. 반복 응답을 통한 공동 구축 가능성, 성실함 조건에서 SDD의 더 넓은 범위, 두 방법의 서로 다른 상호작용 형태를 구분하여 설명한다.',
        '- 초록과 리뷰어 답변: 최종 분석 범위와 같은 결론을 반영한다. 인간 평가 및 추론통계는 별도로 수행·확정한 자료만 포함한다.', '',
        '## 조건별 최종 결과', '']

    def select(c, j, **filters):
        return [r for r in rows if r['condition'] == c and r['judge'] == j
                and all(r[k] == v for k, v in filters.items())]

    def cell(rs, k, sd=True):
        s = stats([r[k] for r in rs])
        if not s['n']: return '—'
        return f"{s['mean']:.2f} ± {s['sd']:.2f}" if sd else f"{s['mean']:.2f}"

    def table(headers, values):
        lines.append('| ' + ' | '.join(headers) + ' |')
        lines.append('|' + '---|' * len(headers))
        lines.extend('| ' + ' | '.join(map(str, row)) + ' |' for row in values)
        lines.append('')

    for title, metrics, labels in [
        ('공동 구축 요구사항 커버리지(%)', ['core_coverage_pct', 'extended_coverage_pct'], ['핵심', '확장']),
        ('구현 커버리지(%)', ['implementation_core', 'implementation_extended'], ['핵심', '확장']),
        ('공동 구축 횟수와 응답 분류', ['n_g', 'n_c', 'n_a', 'n_m'], ['N_g', 'N_c', 'N_a', 'N_m'])]:
        lines += ['### ' + title, '']
        table(['조건', 'Judge'] + labels, [[c, j] + [cell(select(c, j), k) for k in metrics]
                                         for c in CONDS for j in JUDGES])
    lines += ['### 차이 인식률과 판정 범위', '']
    table(['조건', 'Judge', '차이 인식률(%)', '계산 가능 시행', 'N_g>0 시행', '미결정 총수', '제외 결정 총수'],
          [[c, j, cell(rs, 'recognition_pct'), sum(r['recognition_pct'] is not None for r in rs),
            sum(r['n_g'] > 0 for r in rs), sum(r['unresolved'] for r in rs), sum(r['excluded'] for r in rs)]
           for c in CONDS for j in JUDGES for rs in [select(c, j)]])
    lines += ['### 텍스트 상호작용', '', '각 지표는 30회 시행의 평균 ± 표본 표준편차이다. 턴당 중앙값·최댓값은 시행별 값을 먼저 산출한 후 평균했다.', '']
    table(['조건', '응답 수', '응답 수 범위', 'Director 입력 문자', '제시 문자', '턴당 중앙값', '턴당 최댓값'],
          [[c, cell(rs, 'responses'), f"{min(r['responses'] for r in rs)}–{max(r['responses'] for r in rs)}"] +
           [cell(rs, k) for k in ['input_chars', 'throughput', 'chunk_median', 'chunk_max']]
           for c in CONDS for rs in [select(c, 'claude')]])
    lines += ['## Maker 추론 수준별 결과', '',
              '각 행은 두 모델 조합을 합친 10회 시행이다. 서비스 간 같은 추론 수준 명칭이 같은 연산량을 뜻하지 않는다. 아래는 평균이며 표준편차와 개별 조합 결과는 summary.csv에 포함했다.', '']
    table(['조건', '추론 수준', 'Judge', '공동 구축 핵심(%)', '공동 구축 확장(%)', '구현 핵심(%)', '구현 확장(%)', 'N_g'],
          [[c, e, j] + [cell(select(c, j, maker_effort=e), k, False) for k in FIELDS[:5]]
           for c in CONDS for e in EFFORTS for j in JUDGES])
    lines += ['## 모델 역할 조합별 결과', '', '각 조합은 조건별 15회 시행이며 세 Maker 추론 수준을 포함한다. 두 역할의 모델이 함께 바뀌므로 차이를 한 역할만의 효과로 분리하지 않는다.', '']
    table(['조건', 'Maker / Director', 'Judge', '공동 구축 핵심(%)', '공동 구축 확장(%)', '구현 핵심(%)', '구현 확장(%)'],
          [[c, p + ' / ' + ('codex' if p == 'claude' else 'claude'), j] +
           [cell(select(c, j, maker=p), k, False) for k in FIELDS[:4]]
           for c in CONDS for p in JUDGES for j in JUDGES])
    lines += ['## 이전 집계와의 비교', '', '각 셀은 공동 구축 핵심 / 확장 요구사항 커버리지 평균(%)이다.', '']
    table(['조건', 'Judge', '기존 60회', '누적 120회', '최종 150회'],
          [[c, j] + [' / '.join(cell([r for r in select(c, j) if r['block'] <= b], k, False)
                               for k in FIELDS[:2]) for b in [2, 4, 5]]
           for c in CONDS for j in JUDGES])
    lines += ['## 시간과 사용량', '',
        f"시행별 총 경과 시간 합계 {sum(r['elapsed_seconds'] for r in trials)/3600:.2f}시간, 기록된 중단 대기 {sum(r['interruption_seconds'] for r in trials)/3600:.2f}시간, 이를 제외한 실행 {sum(r['execution_minutes'] for r in trials)/60:.2f}시간이다. 블록 간 대기는 포함하지 않는다. 이 값은 환경 준비·보관 및 모델·도구·통신 대기를 포함하며 순수 추론 시간이 아니다.", '']
    table(['조건', '실행 시간 평균 ± SD(분)', '최소–최대(분)'],
          [[c, cell(rs, 'execution_minutes'), f"{min(r['execution_minutes'] for r in rs):.2f}–{max(r['execution_minutes'] for r in rs):.2f}"]
           for c in CONDS for rs in [select(c, 'claude')]])
    lines += ['### Maker·Director 관측 토큰', '',
        '캐시 읽기·생성 토큰은 일반 입력과 분리했다. 추론 토큰은 출력의 부분집합이므로 더하지 않는다. 서로 다른 서비스의 토큰을 구독 잔여량이나 실제 청구 금액으로 환산하지 않는다.', '']
    table(['서비스', '역할', '일반 입력', '캐시 읽기', '캐시 생성', '출력', '추론 출력(부분집합)'],
          [[r['provider'], r['role']] + [f"{r[k]:,}" for k in TOKENS] for r in audit['trial_tokens']])
    lines += ['사용량 완전성을 확인하지 못한 시행: ' + ', '.join(audit['incomplete_trial_usage']) + '. 나머지 148회는 저장된 자원 보고서에서 complete로 기록되어 있다.', '',
              '### Judge 관측 호출', '', '아래는 최종 판정 폴더에 보존된 호출 시도 기준이며 실패 시도도 포함한다. 별도 복구 보관 폴더에만 남은 작업이나 중단 대기를 모두 포함하는 전체 운영 비용은 아니다.', '']
    table(['Judge', '호출 시도 수', '호출 경과 합계(시간)', '사용량 완전성 확인 시도', '일반 입력', '캐시 읽기', '캐시 생성', '출력'],
          [[j, len(a), f"{sum(x['seconds'] for x in a)/3600:.2f}", sum(x['complete'] for x in a)] +
           [f"{sum(x[k] for x in a):,}" for k in TOKENS[:4]]
           for j in JUDGES for a in [[x for x in attempts if x['judge'] == j]]])
    lines += ['Codex Judge의 사용량 완전성 미확인은 원시 스레드 자료 없이 CLI 사용량을 참조하여 하위 작업의 포함 범위를 확정하지 못했다는 뜻이다. Judge 판정이 미완료라는 뜻은 아니며, 최종 판정 600건은 별도로 완료 기록과 대조했다.', '']
    lines += ['## 운영 기록과 집계 검증', '',
              '- 복구 기록이 있는 시행: ' + ', '.join(r['trial_id'] for r in audit['recoveries']) + '. 최종 완료 여부와 무중단 실행 여부는 구분해야 한다.',
              '- 600개 필수 판정 파일의 SHA-256을 완료 기록과 대조했다. 읽은 원자료 전체는 집계 전후 해시가 동일함을 확인했다.',
              f"- 기존 120회 CSV와 {audit['prior_value_comparisons']}개 시행별 지표 값을 대조하여 일치함을 확인했다.",
              '- 기존 aggregate.py의 기본 모드는 조건당 5회만 선택하고 루트의 판정 파일을 읽으므로 이 최종 집계에 사용하지 않았다. 동결된 실행 순서와 Judge별 판정 경로를 기준으로 150회를 명시적으로 선택했다. 실행 스크립트는 변경하지 않았다.',
              '- 추론통계와 인간 판정 결과는 이번 자료에 포함하지 않았다. 서로 다른 Judge의 결정 목록을 임의로 맞춰 공동 구축 판정 일치도를 계산하지 않았다.', '',
              '## 재현 자료', '',
              f'- 집계 스크립트: `{PREFIX}.py`',
              f'- 시행·Judge별 지표(300행): `{PREFIX}-runs.csv`',
              f'- 시행별 상호작용·시간(150행): `{PREFIX}-trials.csv`',
              f'- 조건·추론 수준·모델 조합·차수별 요약: `{PREFIX}-summary.csv`',
              f'- Judge 호출 시도별 시간·사용량: `{PREFIX}-judge-attempts.csv`',
              f'- 출처 해시·요구사항 연결·복구 기록: `{PREFIX}-evidence.json`', '']
    (HERE / f'{PREFIX}.md').write_text('\n'.join(lines))


if __name__ == '__main__':
    main()
