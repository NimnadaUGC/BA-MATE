"""Safe local project-folder registration and original-file materialization."""
import base64
import hashlib
import json
import os
import re
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
        sources = root / 'sources'
        if sources.is_symlink():
            raise HTTPException(422, 'The sources location cannot be a symbolic link.')
        sources.mkdir(exist_ok=True)
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
    destination.parent.mkdir(parents=True, exist_ok=True)
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
    sources = (root / 'sources').resolve()
    if not sources.is_relative_to(root):
        raise HTTPException(422, 'The sources location leaves the connected project folder.')
    sources.mkdir(exist_ok=True)
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
        destination = _collision_safe_destination(sources, relative, data).resolve()
        if not destination.is_relative_to(sources):
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
