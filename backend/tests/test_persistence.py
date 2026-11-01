import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from app import persistence, runtime


class WorkspacePersistenceTests(unittest.TestCase):
    def test_simultaneous_saves_from_same_revision_cannot_overwrite_each_other(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(runtime, 'DATA_DIR', Path(directory)):
            persistence.save_workspace({'projects': [{'id': 'initial'}]}, 0)
            start = threading.Barrier(2)

            def save(name):
                start.wait()
                try:
                    return ('saved', persistence.save_workspace({'projects': [{'id': name}]}, 1))
                except ValueError:
                    return ('conflict', name)

            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(save, ['window-a', 'window-b']))
            self.assertCountEqual([status for status, _ in results], ['saved', 'conflict'])
            current = persistence.read_workspace()
            self.assertEqual(current['revision'], 2)
            self.assertIn(current['state']['projects'][0]['id'], ['window-a', 'window-b'])

