import unittest
from unittest.mock import AsyncMock, patch
from pathlib import Path
import tempfile
from app import runtime
from app.qualification import qualify_profile, record_human_review
from fastapi import HTTPException

class QualificationTests(unittest.IsolatedAsyncioTestCase):
    async def test_synthetic_qualification_records_every_task_without_project_content(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(runtime, 'DATA_DIR', Path(directory)):
            result = {'metadata': {'usage': {'input_tokens': 10, 'output_tokens': 5, 'cost': None}, 'context_hash': 'fixed'}, 'result': {'proposal': {'summary': 'synthetic'}}}
            with patch('app.qualification.execute', AsyncMock(return_value=result)) as execute:
                report = await qualify_profile()
            self.assertTrue(report['structured_tasks_passed'])
            self.assertFalse(report['qualified_for_pilot'])
            self.assertEqual(len(report['results']), 6)
            self.assertEqual(execute.await_count, 6)
            self.assertEqual({call.args[0].project_id for call in execute.await_args_list}, {'synthetic-qualification'})
            self.assertTrue((Path(directory) / 'model-qualification.json').exists())
            reviewed = record_human_review([{'task': task, 'correction_count': 0} for task in ['clarify', 'requirements', 'validate', 'diagram', 'document', 'impact']], True)
            self.assertTrue(reviewed['qualified_for_pilot'])

    async def test_review_requires_a_saved_passing_proposal(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(runtime, 'DATA_DIR', Path(directory)):
            runtime.save_qualification({'structured_tasks_passed': False, 'results': [
                {'task': 'clarify', 'status': 'failed', 'human_reviewed': False},
                {'task': 'document', 'status': 'passed', 'human_reviewed': False},
            ]})
            for task in ('clarify', 'document', 'unknown'):
                with self.assertRaises(HTTPException):
                    record_human_review([{'task': task, 'correction_count': 0}], True)
            self.assertFalse(any(result['human_reviewed'] for result in runtime.load_qualification()['results']))

    async def test_legacy_counts_cannot_qualify_an_unreviewed_new_flow(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(runtime, 'DATA_DIR', Path(directory)):
            runtime.save_qualification({'structured_tasks_passed': True, 'results': [
                {'task': 'clarify', 'status': 'passed', 'synthetic_proposal': {'summary': 'a'}, 'human_reviewed': True, 'human_corrections': 0},
                {'task': 'document', 'status': 'passed', 'synthetic_proposal': {'summary': 'b'}, 'human_reviewed': True, 'human_corrections': 0},
            ]})
            result = record_human_review([{'task': 'clarify', 'correction_count': 0}], True)
            self.assertFalse(result['qualified_for_pilot'])
            result = record_human_review([{'task': 'document', 'correction_count': 0}], True)
            self.assertTrue(result['qualified_for_pilot'])
