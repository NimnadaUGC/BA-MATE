"""Synthetic, opt-in profile qualification. It never sends project work to a model."""
import os
import platform
import time
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from . import runtime
from .contracts import RunRequest
from .workflow import execute
from .token_management import resolve_config

TASK_PROMPTS = {
    'clarify': 'Identify one material gap in the synthetic leave-request rule.',
    'requirements': 'Draft one requirement with testable criteria from the supplied rule.',
    'validate': 'Identify one ambiguity or verification concern in the supplied rule.',
    'diagram': 'Draft one Mermaid flowchart for the supplied leave-request rule.',
    'document': 'Draft one concise SRS section from the supplied rule.',
    'impact': 'Assess a change from 48 hours to 72 hours for the supplied rule.',
}
SYNTHETIC_CONTEXT = [
    {'id': 'SYN-BRIEF', 'type': 'Brief', 'version': 1, 'provenance': 'BA Mate synthetic qualification case', 'priority': 100,
     'content': 'Synthetic case only. Employees submit a leave request. A manager approves it. A confirmed policy decision says a pending request expires after 48 hours.'},
    {'id': 'SYN-DECISION', 'type': 'Clarification', 'version': 1, 'provenance': 'BA Mate synthetic qualification case', 'priority': 90,
     'content': 'Status: Answered\nAnswer: Pending leave requests expire after 48 hours.\nSource: SYN-BRIEF'},
]

def error_category(error):
    detail = getattr(error, 'detail', str(error)).lower()
    if 'key' in detail or 'credential' in detail: return 'credentials'
    if 'quota' in detail or 'busy' in detail: return 'quota'
    if 'too long' in detail or 'timeout' in detail: return 'timeout'
    if 'structured' in detail or 'format' in detail or 'proposal' in detail or 'schema' in detail: return 'schema'
    if 'cannot reach' in detail or 'unavailable' in detail or 'not found' in detail: return 'unavailable'
    return 'unknown'

def device_memory_mb():
    try:
        return round((os.sysconf('SC_PAGE_SIZE') * os.sysconf('SC_PHYS_PAGES')) / (1024 * 1024))
    except (AttributeError, OSError, ValueError):
        return None

async def qualify_profile():
    cfg = await resolve_config(runtime.config.model_copy(deep=True))
    results = []
    for task, prompt in TASK_PROMPTS.items():
        started = time.monotonic()
        request = RunRequest.model_validate({
            'request_id': f'qual-{task}-{uuid.uuid4().hex[:12]}', 'project_id': 'synthetic-qualification',
            'goal_id': 'synthetic-goal', 'task': task, 'prompt': prompt, 'context': SYNTHETIC_CONTEXT,
            'condition': 'Proposed workflow', 'cloud_allowed': True,
        })
        try:
            output = await execute(request)
            results.append({'task': task, 'status': 'passed', 'latency_ms': round((time.monotonic() - started) * 1000),
                            'usage': output['metadata']['usage'], 'context_hash': output['metadata']['context_hash'],
                            'synthetic_proposal': output['result']['proposal'],
                            'human_corrections': None, 'human_reviewed': False})
        except HTTPException as error:
            results.append({'task': task, 'status': 'failed', 'latency_ms': round((time.monotonic() - started) * 1000),
                            'error_category': error_category(error), 'message': error.detail, 'usage': {'input_tokens': None, 'output_tokens': None, 'cost': None},
                            'human_corrections': None, 'human_reviewed': False})
        except Exception:
            results.append({'task': task, 'status': 'failed', 'latency_ms': round((time.monotonic() - started) * 1000),
                            'error_category': 'unknown', 'message': 'Unexpected local qualification failure. No project content was used.',
                            'usage': {'input_tokens': None, 'output_tokens': None, 'cost': None}, 'human_corrections': None, 'human_reviewed': False})
    report = {
        'report_version': 1, 'at': datetime.now(timezone.utc).isoformat(),
        'profile': {'provider': cfg.provider, 'model': cfg.model, 'base_url': cfg.base_url, 'temperature': cfg.temperature,
                    'context_tokens': cfg.context_tokens, 'context_mode': cfg.context_mode,
                    'output_tokens': cfg.output_tokens, 'timeout_seconds': cfg.timeout_seconds},
        'framework_version': runtime.FRAMEWORK_VERSION, 'prompt_version': runtime.PROMPT_VERSION,
        'device': {'platform': platform.platform(), 'physical_memory_mb': device_memory_mb(), 'accelerator_memory_mb': None,
                   'accelerator_memory_note': 'Not detected by this local service; record it manually if relevant to the study.'},
        'synthetic_case': 'leave-request-48-hour-expiry-v1', 'results': results,
        'known_limits': [
            'Passing this suite shows one synthetic structured proposal per task, not business-analysis quality or equivalence to another model.',
            'Human correction counts require a reviewed scoring protocol and are not inferred by the application.',
            'Unavailable model, invalid key, quota, timeout and malformed-output adapter paths are covered by automated fault tests; repeat live provider-specific checks before admitting a cloud profile.',
        ],
        'structured_tasks_passed': all(result['status'] == 'passed' for result in results),
        'qualified_for_pilot': False,
    }
    runtime.save_qualification(report)
    return report

def record_human_review(reviews, approved_for_pilot):
    report = runtime.load_qualification()
    if not report:
        raise HTTPException(404, 'Run the synthetic qualification before recording human review.')
    by_task = {entry['task']: entry for entry in reviews}
    if len(by_task) != len(reviews):
        raise HTTPException(400, 'Each task may be reviewed only once per submission.')
    available = {result['task']: result for result in report['results']}
    for task in by_task:
        result = available.get(task)
        if not result or result.get('status') != 'passed' or result.get('synthetic_proposal') is None:
            raise HTTPException(400, 'Only a passing task with a saved synthetic proposal can be reviewed.')
    for result in report['results']:
        review = by_task.get(result['task'])
        if review:
            result['human_corrections'] = review['correction_count']
            result['human_reviewed'] = True
            result['review_flow_version'] = 1
    report['qualified_for_pilot'] = bool(
        approved_for_pilot
        and report.get('structured_tasks_passed')
        and bool(report['results'])
        and all(result.get('human_reviewed') and result.get('review_flow_version') == 1 and result.get('status') == 'passed' and result.get('synthetic_proposal') is not None for result in report['results'])
    )
    report['human_reviewed_at'] = datetime.now(timezone.utc).isoformat()
    runtime.save_qualification(report)
    return report
