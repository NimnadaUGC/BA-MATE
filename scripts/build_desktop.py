"""Build on the target OS and CPU architecture; signing is a separate release step."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dir', action='store_true', help='Build an unpacked desktop application')
parser.add_argument('--output', type=Path, help='New output directory; it must not already exist')
args = parser.parse_args()
NPM = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
if not NPM:
    raise SystemExit('Install Node.js and npm before building the desktop package.')
PYTHON = ROOT / 'backend' / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
if not PYTHON.exists():
    raise SystemExit('Run python3 start.py --setup first.')
output = (args.output or ROOT / 'release' / f'desktop-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}').expanduser().resolve()
output.parent.mkdir(parents=True, exist_ok=True)
try:
    output.mkdir()
except FileExistsError:
    raise SystemExit(f'Refusing to overwrite an existing output directory: {output}. Choose a new --output path.')

def run(command, directory=ROOT):
    subprocess.run([str(item) for item in command], cwd=directory, check=True)

try:
    with tempfile.TemporaryDirectory(prefix='ba-mate-desktop-build-') as temporary:
        build = Path(temporary)
        run([NPM, 'ci'], ROOT / 'frontend')
        run([NPM, 'run', 'build'], ROOT / 'frontend')
        run([PYTHON, '-m', 'pip', 'install', 'pyinstaller==6.22.2'])
        # Freeze the reference encoding so the bundled service can run offline.
        run([PYTHON, '-c', "import tiktoken; tiktoken.get_encoding('o200k_base')"])
        cache_dir = build / 'token-cache'
        cache_dir.mkdir()
        run([PYTHON, '-c', "import hashlib, os, pathlib, shutil, tempfile; src = pathlib.Path(os.environ.get('TIKTOKEN_CACHE_DIR', os.environ.get('DATA_GYM_CACHE_DIR', pathlib.Path(tempfile.gettempdir()) / 'data-gym-cache'))) / hashlib.sha1(b'https://openaipublic.blob.core.windows.net/encodings/o200k_base.tiktoken').hexdigest(); shutil.copy2(src, pathlib.Path(__import__('sys').argv[1]) / src.name)", cache_dir])
        run([PYTHON, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--name', 'ba-mate-service', '--distpath', build / 'service', '--workpath', build / 'pyinstaller', '--specpath', build, '--paths', ROOT / 'backend', '--collect-all', 'uvicorn', '--collect-all', 'pypdf', '--collect-all', 'docx', '--collect-all', 'openpyxl', '--collect-all', 'xlrd', '--collect-all', 'tiktoken', '--collect-all', 'tiktoken_ext', '--add-data', f'{cache_dir}{os.pathsep}token-cache', ROOT / 'backend/desktop_entry.py'])
        run([NPM, 'ci'], ROOT / 'desktop')
        config = json.loads((ROOT / 'desktop/package.json').read_text())['build']
        config['directories']['output'] = str(output)
        config['extraResources'] = [
            {'from': str(ROOT / 'frontend/dist'), 'to': 'frontend'},
            {'from': str(build / 'service/ba-mate-service'), 'to': 'service'},
        ]
        config_path = build / 'electron-builder.json'
        config_path.write_text(json.dumps(config))
        run([NPM, 'run', 'package' if args.dir else 'dist', '--', '--config', config_path], ROOT / 'desktop')
except Exception as error:
    raise SystemExit(f'Desktop build did not complete: {error}. Partial output, if any, is in {output}; it was not removed.') from error
print('Desktop build created in', output)
