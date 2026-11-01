import base64
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from app import project_files, runtime


class ProjectFileConcurrencyTests(unittest.TestCase):
    def test_link_failure_does_not_leave_a_partial_original(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(runtime, 'DATA_DIR', Path(directory)):
            created = project_files.create_project_folder(project_files.ProjectFolderCreate(project_id='test', project_name='Synthetic'))
            item = project_files.ProjectFile(name='notes.txt', relative_path='notes.txt', data=base64.b64encode(b'original').decode())
            with patch('app.project_files.os.link', side_effect=OSError('unsupported')):
                with self.assertRaisesRegex(Exception, 'Could not safely copy'):
                    project_files.write_project_files(created['workspace_id'], project_files.ProjectFilesWrite(files=[item]))
            self.assertFalse((Path(created['display_path']) / 'notes.txt').exists())
            self.assertFalse(list(Path(created['display_path']).glob('.*.tmp')))

    def test_simultaneous_copies_do_not_replace_another_original(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(runtime, 'DATA_DIR', Path(directory)):
            created = project_files.create_project_folder(project_files.ProjectFolderCreate(project_id='test', project_name='Synthetic'))
            workspace_id = created['workspace_id']
            barrier = threading.Barrier(2)
            local = threading.local()
            real_link = project_files.os.link

            def overlapping_link(source, destination):
                if not getattr(local, 'waited', False):
                    local.waited = True
                    barrier.wait(timeout=5)
                return real_link(source, destination)

            def copy(data):
                item = project_files.ProjectFile(name='notes.txt', relative_path='notes.txt', data=base64.b64encode(data).decode())
                result = project_files.write_project_files(workspace_id, project_files.ProjectFilesWrite(files=[item]))
                return result['written'][0], data

            with patch('app.project_files.os.link', side_effect=overlapping_link), ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(copy, [b'first original', b'second original']))
            self.assertEqual(len({path for path, _ in results}), 2)
            for name, expected in results:
                self.assertEqual((Path(created['display_path']) / name).read_bytes(), expected)
            self.assertFalse(list(Path(created['display_path']).glob('.*.tmp')))

