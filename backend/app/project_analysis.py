"""Local background extraction of connected project folders.

Extraction is an unreviewed proposal. The browser decides which source revisions
the BA has reviewed and selected for a goal; this worker never grants approval.
"""

import base64
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import HTTPException

from .evidence import SourceUpload, extract_source
from .project_files import MAX_FILE_BYTES, _read_registry

SUPPORTED = {'.pdf', '.docx', '.txt', '.md', '.csv', '.json', '.xlsx', '.xls',
             '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff',
             '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac',
             '.mp4', '.mov', '.m4v', '.webm', '.mkv'}
IGNORED_DIRS = {'.git', 'node_modules', '.venv', '__pycache__'}
_lock = threading.RLock()
_workers: dict[str, threading.Thread] = {}
_snapshots: dict[str, dict] = {}
_stop = threading.Event()


def _root(workspace_id: str) -> Path:
    record = _read_registry().get(workspace_id)
    if not record:
        raise HTTPException(404, 'This project folder is no longer connected.')
    root = Path(record['path']).resolve()
    if not root.is_dir():
        raise HTTPException(404, 'The connected project folder is unavailable.')
    return root


def _paths(root: Path):
    root = root.resolve()
    for current, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [name for name in dirs if name not in IGNORED_DIRS and not name.startswith('.')
                   and not (Path(current) / name).is_symlink()]
        for name in files:
            path = Path(current) / name
            if name.startswith('.') or path.is_symlink():
                continue
            if path.resolve().is_relative_to(root):
                yield path


def _extract_changed_file(job: tuple[Path, Path, str, str]) -> tuple[str, dict]:
    root, path, relative, signature = job
    try:
        if path.is_symlink() or not path.resolve().is_relative_to(root):
            raise ValueError('The source path is no longer inside the project folder.')
        before = path.stat()
        if f'{before.st_mtime_ns}:{before.st_ctime_ns}:{before.st_size}' != signature:
            raise ValueError('The source changed during scanning; it will be retried.')
        data = path.read_bytes()
        after = path.stat()
        if (before.st_mtime_ns, before.st_ctime_ns, before.st_size) != (after.st_mtime_ns, after.st_ctime_ns, after.st_size):
            raise ValueError('The source changed during extraction; it will be retried.')
        result = extract_source(SourceUpload(name=path.name, data=base64.b64encode(data).decode('ascii')))
        return relative, {'relative_path': relative, 'signature': signature, 'status': 'needs_review',
                          'name': path.name, 'sha256': result['sha256'], 'content': result['content'],
                          'passages': result['passages'], 'limitations': result['limitations'],
                          'media_kind': result['media_kind'], 'extractable': result['extractable']}
    except Exception as exc:
        return relative, {'relative_path': relative, 'signature': signature, 'status': 'failed',
                          'error': str(getattr(exc, 'detail', exc))[:300]}


def _scan(workspace_id: str, root: Path) -> None:
    root = root.resolve()
    with _lock:
        previous = _snapshots.get(workspace_id, {}).get('sources', {})
    discovered = {}
    pending: list[tuple[Path, Path, str, str]] = []
    folders = []
    for current, dirs, _ in os.walk(root, followlinks=False):
        dirs[:] = [name for name in dirs if name not in IGNORED_DIRS and not name.startswith('.')
                   and not (Path(current) / name).is_symlink()]
        folders.extend((Path(current) / name).relative_to(root).as_posix() for name in dirs)
    for path in _paths(root):
        relative = path.relative_to(root).as_posix()
        signature = None
        try:
            stat = path.stat()
            signature = f'{stat.st_mtime_ns}:{stat.st_ctime_ns}:{stat.st_size}'
            old = previous.get(relative)
            if old and old.get('signature') == signature and old.get('status') != 'failed':
                discovered[relative] = old
                continue
            if path.suffix.lower() not in SUPPORTED:
                discovered[relative] = {'relative_path': relative, 'signature': signature,
                                        'name': path.name, 'status': 'unsupported',
                                        'error': 'This format is retained in the project folder but cannot be extracted yet.'}
                continue
            if not 0 < stat.st_size <= MAX_FILE_BYTES:
                discovered[relative] = {'relative_path': relative, 'signature': signature,
                                        'status': 'unsupported', 'error': 'Files must be between 1 byte and 25 MB.'}
                continue
            pending.append((root, path, relative, signature))
        except Exception as exc:
            discovered[relative] = {'relative_path': relative, 'signature': signature, 'status': 'failed',
                                    'error': str(getattr(exc, 'detail', exc))[:300]}
    if pending:
        with ThreadPoolExecutor(max_workers=min(4, len(pending)), thread_name_prefix='ba-mate-extract') as pool:
            for relative, extracted in pool.map(_extract_changed_file, pending):
                discovered[relative] = extracted
    with _lock:
        _snapshots[workspace_id] = {'status': 'ready', 'sources': dict(sorted(discovered.items())), 'folders': sorted(folders),
                                    'source_count': len(discovered)}


def _watch(workspace_id: str, root: Path) -> None:
    while not _stop.is_set() and root.is_dir():
        try:
            _scan(workspace_id, root)
        except Exception as exc:
            with _lock:
                _snapshots[workspace_id] = {'status': 'failed', 'sources': {}, 'error': str(exc)[:300]}
        _stop.wait(10)


def analysis_snapshot(workspace_id: str) -> dict:
    root = _root(workspace_id)
    with _lock:
        worker = _workers.get(workspace_id)
        if not worker or not worker.is_alive():
            _snapshots[workspace_id] = {'status': 'scanning', 'sources': _snapshots.get(workspace_id, {}).get('sources', {})}
            worker = threading.Thread(target=_watch, args=(workspace_id, root), daemon=True,
                                      name=f'ba-mate-index-{workspace_id[:8]}')
            _workers[workspace_id] = worker
            worker.start()
        return dict(_snapshots[workspace_id])


def stop_analysis() -> None:
    _stop.set()
