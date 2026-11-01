"""Local-only research application service. Not a multi-tenant hosted API."""
import os
import asyncio
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from . import runtime
from .contracts import RunRequest
from .evidence import SourceUpload, extract_source
from .persistence import read_workspace, save_workspace
from .project_files import ProjectFolderCreate, ProjectFilesWrite, ProjectFoldersCreate, choose_existing_project_folder, create_project_folder, write_project_files, create_project_directories, read_project_file
from .project_analysis import analysis_snapshot, stop_analysis
from .setup_assist import SetupAssistRequest, propose_setup
from .project_agents import AgentStart, start_agents, agent_status, agent_history, background_project_scheduler
from .workflow import execute
from .providers import ModelProvider
from .qualification import qualify_profile, record_human_review
from .token_management import model_capabilities, resolve_config

PORT = os.getenv('BA_MATE_PORT', '8000')
ORIGINS = {f'http://{host}:{port}' for host in ['localhost', '127.0.0.1'] for port in ['5173', PORT]}

@asynccontextmanager
async def lifespan(app):
    runtime.load_config()
    scheduler = asyncio.create_task(background_project_scheduler())
    try:
        yield
    finally:
        scheduler.cancel()
        try:
            await scheduler
        except asyncio.CancelledError:
            pass
        stop_analysis()

app = FastAPI(title='BA Mate local research service', version=runtime.APP_VERSION, lifespan=lifespan)

@app.middleware('http')
async def local_boundary(request: Request, call_next):
    host = request.url.hostname
    origin = request.headers.get('origin')
    if host not in {'localhost', '127.0.0.1', 'testserver'} or (origin and origin not in ORIGINS):
        return JSONResponse({'detail': 'This service accepts local BA Mate connections only.'}, status_code=403)
    if request.method == 'OPTIONS':
        return await call_next(request)
    if request.url.path.startswith('/api/') and request.url.path not in {'/api/session', '/api/health'}:
        if not secrets.compare_digest(request.headers.get('x-ba-session', ''), runtime.SESSION_TOKEN):
            return JSONResponse({'detail': 'Reopen BA Mate to reconnect to the local service.'}, status_code=401)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    if request.url.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store'
    else:
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    return response

app.add_middleware(CORSMiddleware, allow_origins=list(ORIGINS), allow_methods=['GET','POST','PUT','DELETE'], allow_headers=['Content-Type','X-BA-Session'])

@app.get('/api/session')
def session():
    return {'token': runtime.SESSION_TOKEN}

@app.get('/api/health')
def health():
    return {'status': 'ok', 'version': runtime.APP_VERSION, 'mode': 'local', 'training': False}

@app.get('/api/settings')
def settings():
    return runtime.public_config()

@app.put('/api/settings')
async def set_settings(value: runtime.ProviderConfig):
    await resolve_config(value)
    runtime.save_config(value)
    return runtime.public_config()

@app.get('/api/settings/capabilities')
async def settings_capabilities(provider: str, model: str, refresh: bool = False):
    return await model_capabilities(provider, model, refresh)


@app.post('/api/settings/test')
async def test_connection():
    result = await ModelProvider(runtime.config.model_copy(deep=True)).complete([{'role': 'user', 'content': 'Reply with: BA Mate connection ready.'}])
    return {'ok': True, 'model': result['model'], 'provider': result['provider'], 'message': result['text'][:300]}

@app.delete('/api/settings/credential')
def clear_credential():
    runtime.clear_session_credential()
    return runtime.public_config()

@app.get('/api/settings/qualification')
def qualification():
    return {'report': runtime.load_qualification()}

@app.post('/api/settings/qualification')
async def run_qualification():
    return {'report': await qualify_profile()}

class QualificationReview(BaseModel):
    task: str = Field(min_length=1, max_length=30)
    correction_count: int = Field(ge=0, le=10000)

class QualificationReviewRequest(BaseModel):
    reviews: list[QualificationReview] = Field(max_length=6)
    approved_for_pilot: bool = False

@app.post('/api/settings/qualification/review')
def review_qualification(value: QualificationReviewRequest):
    return {'report': record_human_review([review.model_dump() for review in value.reviews], value.approved_for_pilot)}

@app.post('/api/sources/extract')
async def source(request: SourceUpload):
    return await run_in_threadpool(extract_source, request)

@app.post('/api/setup/propose')
async def setup_proposal(request: SetupAssistRequest):
    return await propose_setup(request)

@app.post('/api/project-folders')
async def project_folder(request: ProjectFolderCreate):
    return await run_in_threadpool(create_project_folder, request)

@app.post('/api/project-folders/choose')
async def project_folder_choose():
    return await run_in_threadpool(choose_existing_project_folder)

@app.post('/api/project-folders/{workspace_id}/files')
async def project_folder_files(workspace_id: str, request: ProjectFilesWrite):
    return await run_in_threadpool(write_project_files, workspace_id, request)

@app.post('/api/project-folders/{workspace_id}/directories')
async def project_folder_directories(workspace_id: str, request: ProjectFoldersCreate):
    return await run_in_threadpool(create_project_directories, workspace_id, request)

@app.get('/api/project-folders/{workspace_id}/file')
async def project_folder_file(workspace_id: str, relative_path: str):
    return await run_in_threadpool(read_project_file, workspace_id, relative_path)

@app.get('/api/project-folders/{workspace_id}/analysis')
async def project_folder_analysis(workspace_id: str):
    return await run_in_threadpool(analysis_snapshot, workspace_id)

@app.post('/api/project-agents')
async def project_agents_start(request: AgentStart):
    return await start_agents(request)

@app.get('/api/project-agents/{workspace_id}')
async def project_agents_status(workspace_id: str):
    return agent_status(workspace_id)

@app.get('/api/project-agents/{workspace_id}/history')
async def project_agents_history(workspace_id: str):
    return agent_history(workspace_id)

class WorkspaceSave(BaseModel):
    expected_revision: int = Field(ge=0)
    state: dict

@app.get('/api/workspace')
def workspace():
    return read_workspace()

@app.put('/api/workspace')
def persist(value: WorkspaceSave):
    state = value.state
    if not isinstance(state.get('projects'), list) or not isinstance(state.get('schemaVersion'), int):
        raise HTTPException(422, 'The workspace package is invalid.')
    try:
        revision = save_workspace(state, value.expected_revision)
        return {'revision': revision}
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc

_workflow_tasks: dict[str, asyncio.Task] = {}
_cancelled_workflow_requests: dict[str, float] = {}

def _prune_cancelled_workflow_requests():
    now = time.monotonic()
    for key, expiry in list(_cancelled_workflow_requests.items()):
        if expiry <= now:
            del _cancelled_workflow_requests[key]

class WorkflowCancellation(BaseModel):
    request_id: str = Field(min_length=1, max_length=100)

@app.post('/api/v1/workflow/cancel')
async def cancel_workflow(value: WorkflowCancellation):
    _prune_cancelled_workflow_requests()
    # Retain early cancellations briefly in case the run arrives after this request.
    if len(_cancelled_workflow_requests) >= 1000:
        _cancelled_workflow_requests.pop(next(iter(_cancelled_workflow_requests)))
    _cancelled_workflow_requests[value.request_id] = time.monotonic() + 120
    task = _workflow_tasks.get(value.request_id)
    if task and not task.done():
        task.cancel()
    return {'cancelled': bool(task)}

@app.post('/api/v1/workflow/run')
async def run(req: RunRequest):
    _prune_cancelled_workflow_requests()
    if req.request_id in _cancelled_workflow_requests:
        raise HTTPException(409, 'This request was cancelled before it started.')
    if req.request_id in _workflow_tasks:
        raise HTTPException(409, 'A request with this identifier is already running.')
    task = asyncio.create_task(execute(req))
    _workflow_tasks[req.request_id] = task
    try:
        return await task
    except asyncio.CancelledError as exc:
        raise HTTPException(499, 'The request was cancelled by the client.') from exc
    finally:
        if _workflow_tasks.get(req.request_id) is task:
            del _workflow_tasks[req.request_id]

# Old deterministic routes must not accidentally serve synthetic evidence.
@app.api_route('/api/v1/{path:path}', methods=['GET', 'POST'])
def removed_mock_route(path: str):
    raise HTTPException(410, 'This demonstration endpoint was retired. Use the governed workflow endpoint.')

DIST = Path(os.getenv('BA_MATE_FRONTEND_DIR', Path(__file__).resolve().parents[2] / 'frontend' / 'dist'))
@app.get('/{path:path}')
def frontend(path: str):
    resolved = (DIST / path).resolve()
    if not resolved.is_relative_to(DIST.resolve()):
        raise HTTPException(404)
    if resolved.is_file():
        return FileResponse(resolved)
    index = DIST / 'index.html'
    if index.exists():
        return FileResponse(index)
    raise HTTPException(404, 'Build the frontend or start its development server.')
