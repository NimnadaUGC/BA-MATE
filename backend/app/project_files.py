"""Safe local project-folder registration and original-file materialization."""
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

from fastapi import HTTPException
from pydantic import BaseModel, Field

from . import runtime


MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_BATCH_BYTES = 150 * 1024 * 1024


class ProjectFolderCreate(BaseModel):
    project_id: str = Field(min_length=1, max_length=200)
    project_name: str = Field(min_length=1, max_length=200)
    selected_path: str | None = Field(default=None, max_length=4096)


class ProjectFile(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    relative_path: str | None = Field(default=None, max_length=2048)
    data: str = Field(max_length=35 * 1024 * 1024)


class ProjectFilesWrite(BaseModel):
    files: list[ProjectFile] = Field(max_length=1000)


class ProjectFoldersCreate(BaseModel):
    folders: list[str] = Field(max_length=100)


def choose_existing_project_folder() -> dict | None:
    """Open the host's folder dialog for browsers without directory handles."""
    if sys.platform != 'darwin':
        raise HTTPException(501, 'Direct folder selection is unavailable on this system. Use the desktop app or a browser with folder access.')
    try:
        result = subprocess.run(
            ['/usr/bin/osascript', '-e', 'POSIX path of (choose folder with prompt "Choose an existing BA Mate project folder")'],
            capture_output=True, text=True, timeout=180, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise HTTPException(503, 'The macOS folder picker could not open. Try again or use the desktop app.') from exc
    if result.returncode:
        if '(-128)' in result.stderr or 'User canceled' in result.stderr:
            return None
        raise HTTPException(503, 'The macOS folder picker could not complete. Try again or use the desktop app.')
    if not result.stdout.strip():
        raise HTTPException(503, 'The macOS folder picker did not return a folder.')
    try:
        selected = Path(result.stdout.strip()).resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise HTTPException(422, 'The selected folder is no longer available.') from exc
    if not selected.is_dir():
        raise HTTPException(422, 'Choose a folder rather than a file.')
    return {'name': selected.name, 'path': str(selected)}


def _registry_path() -> Path:
    return runtime.DATA_DIR / 'project-folders.json'


def _read_registry() -> dict:
    path = _registry_path()
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _write_registry(value: dict) -> None:
    runtime.DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = _registry_path()
    fd, temporary = tempfile.mkstemp(prefix='project-folders-', suffix='.json', dir=runtime.DATA_DIR)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        path.chmod(0o600)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _slug(value: str) -> str:
    cleaned = re.sub(r'[^A-Za-z0-9._-]+', '-', value.strip()).strip('-.')
    return (cleaned[:80] or 'project').lower()


def create_project_folder(request: ProjectFolderCreate) -> dict:
    if request.selected_path:
        root = Path(request.selected_path).expanduser()
        if not root.is_absolute():
            raise HTTPException(422, 'Choose an absolute project folder.')
        try:
            root.mkdir(parents=True, exist_ok=True)
            root = root.resolve(strict=True)
        except OSError as exc:
            raise HTTPException(422, 'The selected folder is not writable.') from exc
        if root in {Path(root.anchor).resolve(), Path.home().resolve()}:
            raise HTTPException(422, 'Choose a dedicated project folder rather than a drive root or home folder.')
        kind = 'selected'
    else:
        suffix = _slug(request.project_id)[-12:]
        root = runtime.DATA_DIR / 'projects' / f'{_slug(request.project_name)}-{suffix}'
        try:
            root.mkdir(parents=True, exist_ok=True)
            root = root.resolve(strict=True)
        except OSError as exc:
            raise HTTPException(422, 'BA Mate could not create the managed project folder.') from exc
        kind = 'managed'
    try:
        uploads = root / 'Uploaded Sources'
        if uploads.is_symlink():
            raise HTTPException(422, 'The uploaded sources location cannot be a symbolic link.')
        uploads.mkdir(exist_ok=True)
        probe = root / '.ba-mate-write-test'
        probe.write_bytes(b'')
        probe.unlink()
    except OSError as exc:
        raise HTTPException(422, 'The selected folder is not writable.') from exc
    workspace_id = str(uuid.uuid4())
    registry = _read_registry()
    registry[workspace_id] = {'path': str(root), 'kind': kind, 'project_id': request.project_id}
    _write_registry(registry)
    return {'workspace_id': workspace_id, 'folder_name': root.name, 'display_path': str(root), 'kind': kind}


def _safe_relative_path(file: ProjectFile) -> Path:
    raw = (file.relative_path or file.name).replace('\\', '/')
    if raw.startswith('/') or any(part in {'.', '..'} for part in raw.split('/')):
        raise HTTPException(422, 'A source path must stay inside the project folder.')
    parts = []
    for part in raw.split('/'):
        if not part or part in {'.', '..'}:
            continue
        safe = re.sub(r'[<>:"|?*\x00-\x1f]', '_', part).strip()
        if safe:
            parts.append(safe[:255])
    if not parts:
        raise HTTPException(422, 'A source file has an invalid name.')
    return Path(*parts)


def _collision_safe_destination(root: Path, relative: Path, data: bytes) -> Path:
    destination = root / relative
    parent = root
    for part in relative.parts[:-1]:
        parent = parent / part
        if parent.is_symlink() or not parent.parent.resolve().is_relative_to(root.resolve()):
            raise HTTPException(422, 'A source folder would leave the connected project folder.')
        parent.mkdir(exist_ok=True)
    if destination.is_symlink():
        raise HTTPException(422, 'A source file cannot be written through a symbolic link.')
    if not destination.exists():
        return destination
    try:
        if hashlib.sha256(destination.read_bytes()).digest() == hashlib.sha256(data).digest():
            return destination
    except OSError as exc:
        raise HTTPException(422, f'Could not inspect existing file {relative.name}.') from exc
    stem, suffix = destination.stem, destination.suffix
    for index in range(1, 1000):
        candidate = destination.with_name(f'{stem} ({index}){suffix}')
        if not candidate.exists():
            return candidate
    raise HTTPException(422, f'Too many files named {relative.name} exist in the project folder.')


def write_project_files(workspace_id: str, request: ProjectFilesWrite) -> dict:
    record = _read_registry().get(workspace_id)
    if not record:
        raise HTTPException(404, 'This project folder is no longer connected. Choose it again.')
    root = Path(record['path']).resolve()
    if not root.is_dir():
        raise HTTPException(404, 'The connected project folder is unavailable. Choose it again.')
    uploads = (root / 'Uploaded Sources').resolve()
    if not uploads.is_relative_to(root):
        raise HTTPException(422, 'The uploaded sources location leaves the connected project folder.')
    uploads.mkdir(exist_ok=True)
    decoded: list[tuple[ProjectFile, bytes]] = []
    total = 0
    for item in request.files:
        try:
            data = base64.b64decode(item.data, validate=True)
        except ValueError as exc:
            raise HTTPException(422, f'{item.name} contains invalid file data.') from exc
        if not data or len(data) > MAX_FILE_BYTES:
            raise HTTPException(422, f'{item.name} must be between 1 byte and 25 MB.')
        total += len(data)
        if total > MAX_BATCH_BYTES:
            raise HTTPException(422, 'The selected batch exceeds 150 MB.')
        decoded.append((item, data))
    written = []
    for item, data in decoded:
        relative = _safe_relative_path(item)
        destination = _collision_safe_destination(root, relative if item.relative_path else Path('Uploaded Sources') / relative, data).resolve()
        if not destination.is_relative_to(root):
            raise HTTPException(422, 'A source path would leave the project folder.')
        temporary = destination.with_name(f'.{destination.name}.{uuid.uuid4().hex}.tmp')
        try:
            temporary.write_bytes(data)
            os.replace(temporary, destination)
        except OSError as exc:
            if temporary.exists():
                temporary.unlink()
            raise HTTPException(422, f'Could not copy {item.name} into the project folder.') from exc
        written.append(str(destination.relative_to(root)))
    return {'written': written, 'folder_name': root.name, 'kind': record['kind']}


def create_project_directories(workspace_id: str, request: ProjectFoldersCreate) -> dict:
    record = _read_registry().get(workspace_id)
    if not record:
        raise HTTPException(404, 'This project folder is no longer connected.')
    root = Path(record['path']).resolve()
    if not root.is_dir():
        raise HTTPException(404, 'The connected project folder is unavailable.')
    created = []
    for name in request.folders:
        if not name.strip() or any(part in {'', '.', '..'} for part in name.replace('\\', '/').split('/')):
            raise HTTPException(422, 'A folder path is invalid.')
        relative = _safe_relative_path(ProjectFile(name='folder', relative_path=name, data='x'))
        destination = root
        for part in relative.parts:
            destination = destination / part
            if destination.is_symlink() or not destination.parent.resolve().is_relative_to(root):
                raise HTTPException(422, 'A folder path would leave the project folder.')
            destination.mkdir(exist_ok=True)
        created.append(relative.as_posix())
    return {'created': created}


def read_project_file(workspace_id: str, relative_path: str) -> dict:
    record = _read_registry().get(workspace_id)
    if not record:
        raise HTTPException(404, 'This project folder is no longer connected.')
    root = Path(record['path']).resolve()
    relative = _safe_relative_path(ProjectFile(name='source', relative_path=relative_path, data='x'))
    path = root / relative
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise HTTPException(404, 'The original source is unavailable in the project folder.')
    path = path.resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise HTTPException(404, 'The original source is unavailable in the project folder.')
    if not 0 < path.stat().st_size <= MAX_FILE_BYTES:
        raise HTTPException(422, 'This file cannot be opened in BA Mate because it exceeds 25 MB or is empty.')
    return {'name': path.name, 'data': base64.b64encode(path.read_bytes()).decode('ascii')}
