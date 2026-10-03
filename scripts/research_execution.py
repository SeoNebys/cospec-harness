"""Execute the frozen research schedule, stopping at every block and quota gate."""
from __future__ import annotations

import csv
import fcntl
import hashlib
import json
import os
from collections import Counter
from pathlib import Path

import yaml
import broker
import harness
import judge
import llm
import measurement
import resource_report
import run_matrix as matrix
import subscription_quota as quota
import termination

FIELDS = ('trial_id', 'order', 'block', 'condition', 'maker', 'director',
          'maker_effort', 'director_effort')
MODES = ('coverage', 'co-construction')


def load_schedule():
    plan = yaml.safe_load((harness.ROOT / 'config/run-plan.yaml').read_text())
    spec = plan['trial_schedule']
    path = (harness.ROOT / spec['path']).resolve()
    if not path.is_relative_to(harness.ROOT.resolve()):
        raise ValueError('Schedule must be inside the experiment repository')
    with path.open(newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != list(FIELDS):
            raise ValueError('Unexpected schedule columns')
        rows = list(reader)
    expected = {(p['maker'], p['director'], effort, condition)
                for p in spec['model_pairs'] for effort in spec['maker_efforts']
                for condition in spec['conditions']}
    if len(rows) != spec['total_trials'] or len(rows) != spec['blocks'] * spec['trials_per_block']:
        raise ValueError('Unexpected number of trials')
    for index, row in enumerate(rows, 1):
        row['order'], row['block'] = int(row['order']), int(row['block'])
        if (row['order'] != index or row['trial_id'] != f'trial-{index:03d}'
                or row['block'] != (index - 1) // spec['trials_per_block'] + 1
                or row['director_effort'] != spec['director_effort']):
            raise ValueError('Invalid trial identity, order, block, or Director effort')
        if row['maker'] == row['director']:
            raise ValueError('Research schedule requires cross-model pairs')
        for role in ('maker', 'director'):
            llm.select(role, row[role], row[role + '_effort'])
    for block in range(1, spec['blocks'] + 1):
        counts = Counter((r['maker'], r['director'], r['maker_effort'], r['condition'])
                         for r in rows if r['block'] == block)
        if set(counts) != expected or set(counts.values()) != {1}:
            raise ValueError('Each block must contain every combination exactly once')
    if set(spec['conditions']) != set(harness.load_conditions()):
        raise ValueError('Schedule conditions differ from condition definitions')
    return plan, rows


def state_path():
    return harness.ROOT / 'runs/execution-state.json'


def save(state):
    state['updated_at'] = matrix.now()
    state_path().parent.mkdir(parents=True, exist_ok=True)
    matrix.save(state_path(), state)


def active_containers():
    names = matrix.subprocess.check_output(['docker', 'ps', '-a', '--format', '{{.Names}}'], text=True).splitlines()
    return set(names) & {harness.MAKER, harness.DIRECTOR, judge.JUDGE}


def initialize(plan, rows, create):
    fingerprint = matrix.inputs()
    timeout = int(os.environ.get('HARNESS_CALL_TIMEOUT', '10800'))
    if timeout <= 0:
        raise ValueError('Model call timeout must be positive')
    if state_path().exists():
        state = json.loads(state_path().read_text())
        if state['inputs'] != fingerprint or state['call_timeout_seconds'] != timeout:
            raise RuntimeError('Experiment inputs or timeout changed; inspect before continuing')
        if [{k: r[k] for k in FIELDS} for r in state['trials']] != rows:
            raise RuntimeError('Saved execution state differs from the frozen schedule')
        return state
    if not create:
        raise RuntimeError('No research execution state exists')
    if active_containers() or (harness.SESSION / 'context.md').exists():
        raise RuntimeError('Existing role containers or workspace must be inspected before starting')
    if any((harness.ROOT / 'runs').glob('*/run-*/meta.json')):
        raise RuntimeError('Existing archives without schedule state must be inspected')
    image_id = matrix.subprocess.check_output(['docker', 'image', 'inspect', harness.IMAGE,
                                              '--format', '{{.Id}}'], text=True).strip()
    state = {'started_at': matrix.now(), 'status': 'prepared', 'inputs': fingerprint,
             'image_id': image_id, 'call_timeout_seconds': timeout,
             'max_rounds': plan['run_plan']['max_rounds'], 'quota_policy': plan['quota_check'],
             'judges': {p: llm.select('judge', p).metadata() for p in llm.judges()},
             'required_judges': llm.judges(),
             'blocks': {str(b): {'status': 'pending'} for b in range(1, plan['trial_schedule']['blocks'] + 1)},
             'trials': []}
    for row in rows:
        models = {role: llm.select(role, row[role], row[role + '_effort']).metadata()
                  for role in ('maker', 'director')}
        state['trials'].append(dict(row, index=row['order'], status='pending', models=models))
    save(state)
    return state


def archive_path(row):
    return harness.RUNS / row['condition'] / f"run-{row['run']:02d}"


def check_archive(row):
    path = archive_path(row)
    meta = json.loads((path / 'meta.json').read_text())
    if (not (path / 'archive-complete.json').exists()
            or meta.get('trial') != {k: row[k] for k in FIELDS}
            or meta.get('models') != row['models']):
        raise RuntimeError('Archive does not match the scheduled trial')
    return path


def valid_judgment(path, mode, model, image_id):
    data = json.loads(path.read_text())
    judge.validate_result(data, mode)
    if data.get('_execution') != {'model': model, 'image_id': image_id}:
        raise ValueError('Judgment model or image differs from frozen configuration')
    return hashlib.sha256(path.read_bytes()).hexdigest()


def required_judges(state):
    providers = state.get('required_judges', list(state['judges']))
    if (not providers or len(set(providers)) != len(providers)
            or not set(providers) <= set(state['judges'])):
        raise RuntimeError('Required Judges must be a nonempty, unique subset of saved models')
    return {provider: state['judges'][provider] for provider in providers}


def verify_judged(state, block):
    if state['blocks'][str(block)]['status'] != 'judged':
        raise RuntimeError(f'Block {block} must finish judging before the next block starts')
    for row in state['trials']:
        if row['block'] != block:
            continue
        path = check_archive(row)
        for provider, model in required_judges(state).items():
            for mode in MODES:
                saved = row.get('judgments', {}).get(f'{provider}/{mode}', {})
                digest = valid_judgment(judge.result_path(path, provider, mode), mode, model, state['image_id'])
                if saved.get('status') != 'completed' or saved.get('sha256') != digest:
                    raise RuntimeError('Judgment evidence changed or is incomplete')


def gate(state, row, providers, purpose='trial'):
    if matrix.inputs() != state['inputs']:
        raise RuntimeError('Experiment inputs changed; stopping before the next task')
    roles = ({role: row[role] for role in ('maker', 'director')} if purpose == 'trial'
             else {'judge': providers[0]})
    try:
        result = quota.check(roles, state['quota_policy'], purpose)
    except Exception as exc:
        # A pre-call failure must not leave a stale 'judging'/'running' status.
        # Preserve only the exception type: quota/auth errors may contain secrets.
        state.update(status='stopped_on_quota_error', stopped_at=matrix.now(),
                     waiting_trial=row['trial_id'], waiting_purpose=purpose)
        state['quota_error_type'] = type(exc).__name__
        save(state)
        raise
    override = state.get('quota_margin_override', {})
    checks = result.get('checks', [])
    if (not result['allowed'] and checks
            and override.get('authorization') == 'explicit_user_request'
            and override.get('block') == row['block']
            and override.get('purpose') == purpose
            and row['trial_id'] in override.get('trial_ids', [])
            and all(c.get('allowed') or c.get('reason') == 'insufficient_remaining_quota'
                    for c in checks)):
        result = dict(result, allowed=True, allowed_without_override=False,
                      override=dict(override), reason='operator_waived_start_margin')
    event = dict(result, trial_id=row['trial_id'], block=row['block'])
    with (harness.RUNS / 'quota-checks.jsonl').open('a') as stream:
        stream.write(json.dumps(event) + '\n')
    row['last_quota_check'] = result
    if not result['allowed']:
        state.update(status='waiting_for_quota', waiting_trial=row['trial_id'], waiting_purpose=purpose)
        save(state)
        print(f"[research] quota check blocked {purpose} for {row['trial_id']}; no task started", flush=True)
        return False
    state.pop('waiting_trial', None)
    state.pop('waiting_purpose', None)
    state.pop('quota_error_type', None)
    save(state)
    return True


def verify_trial_prerequisites(state, block):
    for earlier in range(1, block):
        authorized = any(
            event.get('authorization') == 'explicit_user_request'
            and event.get('for_block') == block
            and earlier in event.get('deferred_blocks', [])
            for event in state.get('judge_deferrals', []))
        if not authorized or state['blocks'][str(earlier)]['status'] == 'judged':
            verify_judged(state, earlier)
            continue
        prior = [r for r in state['trials'] if r['block'] == earlier]
        if (state['blocks'][str(earlier)]['status'] != 'awaiting_judge'
                or not prior or any(r['status'] not in ('completed', 'capped') for r in prior)):
            raise RuntimeError('Judge deferral requires a fully processed block awaiting judging')
        for row in prior:
            check_archive(row)


def execute_trials(state, block):
    rows = [r for r in state['trials'] if r['block'] == block]
    verify_trial_prerequisites(state, block)
    if state['blocks'][str(block)]['status'] == 'judged':
        verify_judged(state, block)
        print(f'[research] block {block} is already judged; nothing executed')
        return
    for row in rows:
        if row['status'] in ('completed', 'capped'):
            check_archive(row)
            continue
        if row['status'] != 'pending':
            raise RuntimeError(f"{row['trial_id']} was interrupted; preserve evidence and inspect, no automatic rerun")
        if active_containers() or (harness.SESSION / 'context.md').exists():
            raise RuntimeError('Existing containers or workspace will not be overwritten')
        if not gate(state, row, (row['maker'], row['director'])):
            return
        row.update(status='running', started_at=matrix.now())
        state.update(status='running', active_block=block)
        state['blocks'][str(block)]['status'] = 'running'
        save(state)
        timing = harness.WORK / 'timing' / row['trial_id']
        try:
            maker, director = (llm.Model(**row['models'][role]) for role in ('maker', 'director'))
            with measurement.span(timing, 'setup', trial_id=row['trial_id']):
                row['run'] = harness.setup(row['condition'], maker, director,
                                           trial={k: row[k] for k in FIELDS})
            save(state)
            with measurement.span(timing, 'dialogue', trial_id=row['trial_id']):
                summary = broker.run_session(row['condition'], harness.condition_spec(row['condition'])['method'],
                                             row['run'], state['max_rounds'], maker, director)
            row.update(status='archiving', summary=summary)
            save(state)
            with measurement.span(timing, 'archive', trial_id=row['trial_id']):
                harness.teardown()
            row.update(status=termination.outcome(summary), finished_at=matrix.now())
            path = check_archive(row)
            row['resources'] = resource_report.run_report(path)
            row['operations'] = measurement.summarize(timing)
            save(state)
            resource_report.write_batch(harness.ROOT, harness.RUNS / 'resource-usage.json')
            print(f"[research] {row['trial_id']} {row['condition']} {row['status']}", flush=True)
        except BaseException as exc:
            trial_file = harness.SESSION / 'trial.json'
            if not row.get('run') and trial_file.exists():
                try:
                    if json.loads(trial_file.read_text()).get('trial_id') == row['trial_id']:
                        context = harness._parse_context((harness.SESSION / 'context.md').read_text())
                        row['run'] = int(context['run'])
                except (OSError, ValueError, KeyError):
                    pass
            if row['status'] not in ('completed', 'capped'):
                row['status'] = 'archive_failed' if row['status'] == 'archiving' else 'failed'
            row.update(error_type=type(exc).__name__, stopped_at=matrix.now())
            state.update(status='stopped_on_error', stopped_at=matrix.now())
            save(state)
            try:
                resource_report.write_batch(harness.ROOT, harness.RUNS / 'resource-usage.json')
            except Exception as report_error:
                row['resource_report_error_type'] = type(report_error).__name__
                save(state)
            raise
    state['blocks'][str(block)].update(status='awaiting_judge', trials_finished_at=matrix.now())
    state.update(status='awaiting_judge', active_block=block)
    save(state)
    print(f'[research] block {block}: all scheduled trials processed; stopped for judging', flush=True)


def execute_judges(state, block):
    rows = [r for r in state['trials'] if r['block'] == block]
    if any(r['status'] not in ('completed', 'capped') for r in rows):
        raise RuntimeError('The block has unfinished or failed trials; inspect before judging')
    for earlier in range(1, block):
        verify_judged(state, earlier)
    if active_containers():
        raise RuntimeError('Existing role containers must be inspected before judging')
    for row in rows:
        path = check_archive(row)
        tasks = row.setdefault('judgments', {})
        for provider, metadata in required_judges(state).items():
            for mode in MODES:
                key = f'{provider}/{mode}'
                task = tasks.setdefault(key, {'status': 'pending'})
                out = judge.result_path(path, provider, mode)
                if out.exists():
                    digest = valid_judgment(out, mode, metadata, state['image_id'])
                    if task.get('sha256') not in (None, digest):
                        raise RuntimeError('Completed judgment was changed')
                    task.update(status='completed', sha256=digest)
                    save(state)
                    continue
                if task['status'] != 'pending':
                    raise RuntimeError('Interrupted or missing judgment requires inspection, not automatic replay')
                if not gate(state, row, [provider], 'judge'):
                    return
                task.update(status='running', started_at=matrix.now())
                state.update(status='judging', active_block=block)
                state['blocks'][str(block)]['status'] = 'judging'
                save(state)
                try:
                    # Explicit block restart controls retries; disable the legacy quota wait loop.
                    previous = os.environ.get('HARNESS_LIMIT_MAX_WAIT')
                    os.environ['HARNESS_LIMIT_MAX_WAIT'] = '0'
                    try:
                        judge.run_one(path, mode, llm.Model(**metadata))
                    finally:
                        if previous is None:
                            os.environ.pop('HARNESS_LIMIT_MAX_WAIT', None)
                        else:
                            os.environ['HARNESS_LIMIT_MAX_WAIT'] = previous
                    task.update(status='completed', finished_at=matrix.now(),
                                sha256=valid_judgment(out, mode, metadata, state['image_id']))
                    # Judge call records contain their own accounting and timing.
                    save(state)
                except BaseException as exc:
                    task.update(status='failed', error_type=type(exc).__name__, stopped_at=matrix.now())
                    state.update(status='stopped_on_judge_error', stopped_at=matrix.now())
                    save(state)
                    raise
    state['blocks'][str(block)].update(status='judged', judged_at=matrix.now())
    state['status'] = 'finished' if all(b['status'] == 'judged' for b in state['blocks'].values()) else 'ready_for_next_block'
    save(state)
    print(f'[research] block {block}: judging complete; next block requires a separate invocation', flush=True)


def execute(block, judging=False, dry_run=False):
    plan, rows = load_schedule()
    if block not in range(1, plan['trial_schedule']['blocks'] + 1):
        raise ValueError('Block is outside the frozen schedule')
    if dry_run:
        print(json.dumps([r for r in rows if r['block'] == block], indent=2))
        return
    if os.environ.get('HARNESS_AUTH_MODE', 'subscription') != 'subscription':
        raise RuntimeError('Research execution requires subscription authentication')
    with (harness.ROOT / '.matrix.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        matrix.configure(harness.ROOT)
        state = initialize(plan, rows, create=not judging and block == 1)
        harness.IMAGE = state['image_id']
        if judging:
            execute_judges(state, block)
        else:
            execute_trials(state, block)
