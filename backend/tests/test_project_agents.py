import asyncio
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app import runtime
from app.project_analysis import _scan, _snapshots
from app.project_agents import AgentStart, _run, _signature, _write, _tasks, _context_manifest, _snapshot_sources_current, agent_status, agent_history, start_agents, run_registered_projects_once
from app.setup_assist import SetupAssistRequest, propose_setup


class FolderAnalysisTests(unittest.TestCase):
    def test_changed_files_extract_in_parallel(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'one.txt').write_text('One source')
            (root / 'two.txt').write_text('Another source')
            barrier = threading.Barrier(2)
            def extract(_upload):
                barrier.wait(timeout=3)
                return {'sha256': 'review-me', 'content': 'Extracted text', 'passages': [],
                        'limitations': [], 'media_kind': 'text', 'extractable': True}
            with patch('app.project_analysis.extract_source', side_effect=extract):
                _scan('parallel-folder', root)
            self.assertEqual({source['status'] for source in _snapshots['parallel-folder']['sources'].values()}, {'needs_review'})

    def test_nested_existing_file_is_discovered_and_change_reprocessed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            nested = root / 'Interviews'
            nested.mkdir()
            source = nested / 'notes.txt'
            source.write_text('The approval threshold is undecided.')
            _scan('test-folder', root)
            first = _snapshots['test-folder']['sources']['Interviews/notes.txt']
            self.assertEqual(first['status'], 'needs_review')
            self.assertIn('undecided', first['content'])
            source.write_text('The approval threshold was confirmed by the manager.')
            _scan('test-folder', root)
            second = _snapshots['test-folder']['sources']['Interviews/notes.txt']
            self.assertNotEqual(first['sha256'], second['sha256'])


class AgentProposalTests(unittest.IsolatedAsyncioTestCase):
    async def test_changed_original_cannot_start_with_cached_extraction(self):
        workspace_id = '00000000-0000-4000-8000-000000000011'
        with tempfile.TemporaryDirectory() as temporary, patch.object(runtime, 'DATA_DIR', Path(temporary)):
            root = Path(temporary) / 'project'; root.mkdir()
            source = root / 'notes.txt'; source.write_text('Original reviewed note')
            _scan(workspace_id, root)
            snapshot = _snapshots[workspace_id]
            digest = snapshot['sources']['notes.txt']['sha256']
            registry = {workspace_id: {'project_id': 'p1', 'path': str(root)}}
            request = AgentStart(project_id='p1', workspace_id=workspace_id, brief='Review', governance=[],
                active_goal={'title': 'Review'}, approved_sources=[{'path': 'notes.txt', 'sha256': digest}])
            with patch.object(runtime, 'config', runtime.ProviderConfig()), \
                    patch('app.project_agents._read_registry', return_value=registry), \
                    patch('app.project_files._read_registry', return_value=registry), \
                    patch('app.project_agents.analysis_snapshot', return_value=snapshot), \
                    patch('app.project_agents._run', new=AsyncMock()) as run:
                self.assertTrue(_snapshot_sources_current(workspace_id, snapshot['sources'], request.approved_sources))
                source.write_text('Changed before the next scan')
                response = await start_agents(request)
                self.assertEqual(response['status'], 'waiting_for_sources')
                self.assertIn('changed or are unavailable', response['message'])
                run.assert_not_awaited()

    async def test_changed_original_during_intake_discards_partial_proposals(self):
        workspace_id = '00000000-0000-4000-8000-000000000012'
        with tempfile.TemporaryDirectory() as temporary, patch.object(runtime, 'DATA_DIR', Path(temporary)):
            root = Path(temporary) / 'project'; root.mkdir()
            source = root / 'notes.txt'; source.write_text('Original reviewed note')
            _scan(workspace_id, root)
            sources = _snapshots[workspace_id]['sources']
            digest = sources['notes.txt']['sha256']
            request = AgentStart(project_id='p1', workspace_id=workspace_id, brief='Review', governance=[],
                active_goal={'title': 'Review'}, approved_sources=[{'path': 'notes.txt', 'sha256': digest}])
            async def ask(role, _payload, _schema):
                if role == 'source intake':
                    source.write_text('Changed while the first role was running')
                    return {'summary': 'Old intake', 'topics': [], 'review_questions': []}
                if role == 'next-work planning': return {'summary': 'Old plan', 'goals': [], 'clarification_questions': []}
                if role == 'governance review': return {'summary': 'Old governance', 'review_points': []}
                self.fail('Drafting must not run with the changed source')
            with patch('app.project_files._read_registry', return_value={workspace_id: {'path': str(root)}}), \
                    patch('app.project_agents._ask', new=ask):
                await _run(request, sources, 'revision', True)
            result = agent_status(workspace_id)
            self.assertEqual(result['status'], 'failed')
            self.assertEqual(result['roles'], {})
            self.assertIn('Project sources changed', result['error'])

    async def test_manifest_discloses_exact_source_selection_and_truncation(self):
        request = AgentStart(project_id='p1', workspace_id='00000000-0000-4000-8000-000000000008',
            brief='Improve approvals', governance=[], active_goal={'title': 'Clarify approvals'},
            approved_sources=[{'path': 'a.txt', 'sha256': 'reviewed'}, {'path': 'missing.txt', 'sha256': 'old'}], omitted_confirmed_decisions=3,
            omitted_approved_source_selections=2, omitted_browser_sources=4)
        sources = {'a.txt': {'status': 'needs_review', 'sha256': 'reviewed', 'content': 'a' * 6000,
                            'available_characters': 7000}}
        sources.update({f'z{index:02}.txt': {'status': 'needs_review', 'sha256': str(index), 'content': 'note'} for index in range(21)})
        manifest = _context_manifest(request, sources, 'revision-1')
        self.assertEqual(len(manifest['source_intake']['sources']), 20)
        self.assertEqual(manifest['source_intake']['omitted_count'], 6)
        self.assertEqual(manifest['source_intake']['sources'][0]['sent_characters'], 5000)
        self.assertEqual(manifest['source_intake']['sources'][0]['available_characters'], 7000)
        self.assertEqual(manifest['omitted_confirmed_decision_count'], 3)
        self.assertEqual(manifest['omitted_approved_source_selection_count'], 2)
        self.assertEqual(manifest['unmatched_selected_source_count'], 1)
        self.assertEqual([source['path'] for source in manifest['requirement_drafting']['sources']], ['a.txt'])

    async def test_changed_context_does_not_return_old_running_proposals(self):
        workspace_id = '00000000-0000-4000-8000-000000000009'
        request = AgentStart(project_id='p1', workspace_id=workspace_id, brief='New context', governance=[])
        with tempfile.TemporaryDirectory() as temporary, patch.object(runtime, 'DATA_DIR', Path(temporary)), \
                patch.object(runtime, 'config', runtime.ProviderConfig()), \
                patch('app.project_agents._read_registry', return_value={workspace_id: {'project_id': 'p1'}}), \
                patch('app.project_agents.analysis_snapshot', return_value={'status': 'ready', 'sources': {}}):
            _write(workspace_id, {'signature': 'old', 'status': 'running', 'roles': {'planning': {'status': 'ready', 'proposal': {'goals': ['stale']}}}})
            task = asyncio.create_task(asyncio.Event().wait())
            _tasks[workspace_id] = task
            try:
                result = await start_agents(request)
                self.assertEqual(result['status'], 'running')
                self.assertEqual(result['signature'], _signature(request, {}))
                self.assertEqual(result['roles'], {})
            finally:
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
                _tasks.pop(workspace_id, None)

    async def test_prior_run_keeps_original_proposals(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(runtime, 'DATA_DIR', Path(temporary)), \
                patch.object(runtime, 'config', runtime.ProviderConfig()), \
                patch('app.project_agents._ask', new=AsyncMock(side_effect=[
                    {'summary': 'Old intake', 'topics': [], 'review_questions': []},
                    {'summary': 'Old plan', 'goals': [], 'clarification_questions': []},
                    {'summary': 'Old governance', 'review_points': []},
                    {'summary': 'New intake', 'topics': [], 'review_questions': []},
                    {'summary': 'New plan', 'goals': [], 'clarification_questions': []},
                    {'summary': 'New governance', 'review_points': []},
                ])):
            workspace_id = '00000000-0000-4000-8000-000000000010'
            request = AgentStart(project_id='p1', workspace_id=workspace_id, brief='Improve approvals', governance=[])
            await _run(request, {}, 'old-revision')
            await _run(request, {}, 'new-revision')
            history = agent_history(workspace_id)
            self.assertEqual(len(history), 1)
            self.assertEqual(history[0]['roles']['planning']['proposal']['summary'], 'Old plan')
            self.assertEqual(agent_status(workspace_id)['roles']['planning']['proposal']['summary'], 'New plan')

    async def test_independent_role_failure_preserves_other_proposals(self):
        async def ask(role, _payload, _schema):
            if role == 'next-work planning':
                raise ValueError('Planning response was invalid.')
            if role == 'source intake':
                return {'summary': 'Tentative intake', 'topics': [], 'review_questions': []}
            return {'summary': 'Review governance', 'review_points': ['Confirm owner']}
        with tempfile.TemporaryDirectory() as temporary, patch.object(runtime, 'DATA_DIR', Path(temporary)), \
                patch.object(runtime, 'config', runtime.ProviderConfig()), \
                patch('app.project_agents._ask', new=ask):
            workspace_id = '00000000-0000-4000-8000-000000000011'
            await _run(AgentStart(project_id='p1', workspace_id=workspace_id, brief='Review', governance=[]), {}, 'revision')
            result = agent_status(workspace_id)
            self.assertEqual(result['status'], 'ready')
            self.assertEqual(result['roles']['planning']['status'], 'failed')
            self.assertEqual(result['roles']['governance_review']['proposal']['review_points'], ['Confirm owner'])

    async def test_recorded_ba_decisions_trigger_fresh_background_work(self):
        base = AgentStart(project_id='p1', workspace_id='00000000-0000-4000-8000-000000000001',
                          brief='Improve approvals', governance=['Core responsible BA'])
        guided = base.model_copy(update={'active_goal': {'title': 'Clarify approvals'},
            'confirmed_decisions': [{'question': 'Who approves?', 'answer': 'Operations lead', 'owner': 'Sponsor'}]})
        self.assertNotEqual(_signature(base, {}), _signature(guided, {}))

    async def test_failed_run_can_be_retried_with_the_same_project_context(self):
        workspace_id = '00000000-0000-4000-8000-000000000003'
        request = AgentStart(project_id='p1', workspace_id=workspace_id, brief='Improve approvals',
                             governance=['Core responsible BA'])
        with tempfile.TemporaryDirectory() as temporary, patch.object(runtime, 'DATA_DIR', Path(temporary)), \
                patch.object(runtime, 'config', runtime.ProviderConfig()), \
                patch('app.project_agents._read_registry', return_value={workspace_id: {'project_id': 'p1'}}), \
                patch('app.project_agents.analysis_snapshot', return_value={'status': 'ready', 'sources': {}}), \
                patch('app.project_agents._run', new=AsyncMock()) as run:
            _write(workspace_id, {'signature': _signature(request, {}), 'status': 'failed', 'roles': {}, 'requires_human_acceptance': True})
            self.assertEqual((await start_agents(request))['status'], 'failed')
            self.assertEqual((await start_agents(request.model_copy(update={'retry': True})))['status'], 'running')
            await asyncio.sleep(0)
            self.assertEqual(run.await_count, 1)

    async def test_saved_project_context_drives_agents_without_open_browser(self):
        saved = {'state': {'projects': [{
            'id': 'p1', 'workspaceId': '00000000-0000-4000-8000-000000000004', 'workspaceKind': 'managed',
            'description': 'Improve approvals', 'governancePacks': ['Core responsible BA'], 'activeGoalId': 'GOAL-1',
            'goals': [{'id': 'GOAL-1', 'title': 'Clarify approval', 'kind': 'Stakeholder clarification',
                       'description': 'Confirm owner', 'gate': 'Clarify', 'status': 'Active', 'sourceIds': ['SRC-1'],
                       'sourceRevisionPins': {'SRC-1': 'reviewed'}}],
            'clarifications': [{'question': 'Who approves?', 'answer': 'Operations lead',
                                'owner': 'Sponsor', 'status': 'Answered'}],
            'sources': [{'id': 'SRC-1', 'name': 'notes.txt', 'relativePath': 'Interviews/notes.txt',
                         'sha256': 'reviewed', 'approved': True, 'status': 'Analyzed'},
                        {'id': 'SRC-2', 'name': 'unrelated.txt', 'relativePath': 'Other/unrelated.txt',
                         'sha256': 'reviewed-unrelated', 'approved': True, 'status': 'Analyzed'}],
        }]}}
        with patch('app.project_agents.read_workspace', return_value=saved), \
                patch('app.project_agents.analysis_snapshot', return_value={'status': 'ready', 'sources': {}}), \
                patch('app.project_agents.start_agents', new=AsyncMock()) as start:
            await run_registered_projects_once()
            saved['state']['projects'][0]['sources'][0]['sha256'] = 'changed-after-selection'
            await run_registered_projects_once()
        self.assertEqual(start.await_count, 2)
        request = start.await_args_list[0].args[0]
        self.assertEqual(request.active_goal['title'], 'Clarify approval')
        self.assertEqual(request.confirmed_decisions[0]['answer'], 'Operations lead')
        self.assertEqual(request.approved_sources, [{'path': 'Interviews/notes.txt', 'sha256': 'reviewed'}])
        self.assertEqual(start.await_args_list[1].args[0].approved_sources, [])

    async def test_setup_proposal_uses_model_and_keeps_core_safeguards(self):
        response = {'text': json.dumps({'template': 'Blank', 'domain': 'Marine conservation',
            'summary': 'Prepare an environmental project for BA review.', 'policies': ['Review field data consent'] }),
            'provider': 'ollama'}
        with patch.object(runtime, 'config', runtime.ProviderConfig()), patch('app.setup_assist.ModelProvider.complete', new=AsyncMock(return_value=response)):
            result = await propose_setup(SetupAssistRequest(kind='project', description='Track coastal water quality observations'))
        self.assertEqual(result['proposal']['domain'], 'Marine conservation')
        self.assertIn('Core responsible BA', result['proposal']['policies'])
        self.assertTrue(result['requires_human_acceptance'])

    async def test_background_roles_prepare_reviewable_proposals(self):
        answers = [
            {'summary': 'Tentative source topics.', 'topics': ['Approval'], 'review_questions': ['Who approves?']},
            {'summary': 'Suggested next work.', 'goals': [{'title': 'Clarify approvals', 'kind': 'Stakeholder clarification', 'reason': 'Approval is unresolved.'}], 'clarification_questions': ['Who approves?']},
            {'summary': 'Review authority.', 'review_points': ['Confirm approval owner']},
        ]
        async def complete(_provider, messages, _schema):
            role = messages[0]['content'].split('task role: ')[1].split('.')[0]
            index = {'source intake': 0, 'next-work planning': 1, 'governance review': 2}[role]
            return {'text': json.dumps(answers[index]), 'provider': 'ollama'}
        with tempfile.TemporaryDirectory() as temporary, patch.object(runtime, 'DATA_DIR', Path(temporary)), patch('app.project_agents.ModelProvider.complete', new=complete):
            workspace_id = '00000000-0000-4000-8000-000000000001'
            request = AgentStart(project_id='p1', workspace_id=workspace_id, brief='Improve approvals', governance=['Core responsible BA'])
            await _run(request, {'Interviews/notes.txt': {'status': 'needs_review', 'content': 'Approval is unclear.', 'limitations': []}}, 'test-signature')
            result = agent_status(workspace_id)
            self.assertEqual(result['status'], 'ready')
            self.assertEqual(result['roles']['planning']['proposal']['goals'][0]['title'], 'Clarify approvals')
            self.assertTrue(result['requires_human_acceptance'])

    async def test_drafting_uses_only_matching_ba_reviewed_source_revisions(self):
        answers = {
            'source intake': {'summary': 'Approval topic.', 'topics': ['Approval'], 'review_questions': []},
            'next-work planning': {'summary': 'Continue.', 'goals': [], 'clarification_questions': []},
            'governance review': {'summary': 'Review.', 'review_points': []},
            'requirement drafting': {'summary': 'One draft.', 'requirements': [{
                'title': 'Record approvals', 'statement': 'The system shall record each approval decision.',
                'kind': 'Functional', 'priority': 'Should', 'rationale': 'The reviewed note describes approval records.',
                'source_paths': ['Interviews/notes.txt', 'Unapproved/secret.txt']}], 'open_questions': []},
        }
        async def complete(_provider, messages, _schema):
            role = messages[0]['content'].split('task role: ')[1].split('.')[0]
            if role == 'requirement drafting':
                payload = json.loads(messages[1]['content'])
                self.assertEqual([entry['path'] for entry in payload['reviewed_source_excerpts']], ['Interviews/notes.txt'])
            return {'text': json.dumps(answers[role]), 'provider': 'ollama'}
        with tempfile.TemporaryDirectory() as temporary, patch.object(runtime, 'DATA_DIR', Path(temporary)), patch('app.project_agents.ModelProvider.complete', new=complete):
            workspace_id = '00000000-0000-4000-8000-000000000002'
            request = AgentStart(project_id='p1', workspace_id=workspace_id, brief='Improve approvals',
                governance=['Core responsible BA'], active_goal={'title': 'Clarify approvals'},
                approved_sources=[{'path': 'Interviews/notes.txt', 'sha256': 'reviewed'}])
            await _run(request, {
                'Interviews/notes.txt': {'status': 'needs_review', 'sha256': 'reviewed', 'content': 'Record approval decisions.'},
                'Unapproved/secret.txt': {'status': 'needs_review', 'sha256': 'unreviewed', 'content': 'Do not send this.'},
            }, 'draft-signature')
            result = agent_status(workspace_id)
            self.assertEqual(result['status'], 'ready')
            draft = result['roles']['requirement_drafting']['proposal']['requirements'][0]
            self.assertEqual(draft['source_paths'], ['Interviews/notes.txt'])


if __name__ == '__main__':
    unittest.main()
