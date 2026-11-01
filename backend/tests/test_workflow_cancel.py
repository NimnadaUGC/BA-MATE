import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from app import main


class CancellationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncTearDown(self):
        main._workflow_tasks.clear()
        main._cancelled_workflow_requests.clear()

    async def test_cancel_releases_the_inference_slot(self):
        slot = asyncio.Semaphore(1)
        started = asyncio.Event()
        cancelled = asyncio.Event()
        async def execute(_req):
            async with slot:
                started.set()
                try:
                    await asyncio.Event().wait()
                finally:
                    cancelled.set()
        with patch.object(main, 'execute', execute):
            run = asyncio.create_task(main.run(SimpleNamespace(request_id='test-run')))
            await asyncio.wait_for(started.wait(), timeout=1)
            self.assertTrue((await main.cancel_workflow(main.WorkflowCancellation(request_id='test-run')))['cancelled'])
            with self.assertRaises(HTTPException) as error:
                await asyncio.wait_for(run, timeout=1)
        self.assertEqual(error.exception.status_code, 499)
        self.assertTrue(cancelled.is_set())
        await asyncio.wait_for(slot.acquire(), timeout=0.5)
        slot.release()

    async def test_cancel_before_run_prevents_it_starting(self):
        await main.cancel_workflow(main.WorkflowCancellation(request_id='early'))
        with patch.object(main, 'execute') as execute:
            with self.assertRaises(HTTPException) as error:
                await main.run(SimpleNamespace(request_id='early'))
        self.assertEqual(error.exception.status_code, 409)
        execute.assert_not_called()
