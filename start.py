"""Install or start BA Mate locally using Python 3.10+ and Node.js for the build."""
import argparse
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import venv
import webbrowser
ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description='BA Mate local pilot launcher')
parser.add_argument('--setup', action='store_true', help='Install dependencies and build the interface, then exit')
parser.add_argument('--no-browser', action='store_true')
parser.add_argument('--port', type=int, default=int(os.environ.get('BA_MATE_PORT', '8000')))
args = parser.parse_args()
python = ROOT / 'backend/.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
if args.setup:
    if sys.version_info < (3, 10): raise SystemExit('Python 3.10 or newer is required.')
    if not python.exists(): venv.create(ROOT / 'backend/.venv', with_pip=True)
    subprocess.run([str(python), '-m', 'pip', 'install', '-r', str(ROOT / 'backend/requirements.txt')], check=True)
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm: raise SystemExit('Install Node.js and npm, then run setup again.')
    subprocess.run([npm, 'ci'], cwd=ROOT / 'frontend', check=True)
    subprocess.run([npm, 'run', 'build'], cwd=ROOT / 'frontend', check=True)
    print('Setup complete. Start with: python3 start.py')
    raise SystemExit(0)
if not python.exists() or not (ROOT / 'frontend/dist/index.html').exists():
    raise SystemExit('Run python3 start.py --setup first. On Windows use: py start.py --setup')
with socket.socket() as sock:
    try: sock.bind(('127.0.0.1', args.port))
    except OSError: raise SystemExit(f'Port {args.port} is in use. Close the other BA Mate service or choose --port 8001.')
env = {**os.environ, 'BA_MATE_PORT': str(args.port)}
url = f'http://127.0.0.1:{args.port}'
service = subprocess.Popen([str(python), str(ROOT / 'backend/desktop_entry.py')], env=env)
def open_when_ready():
    for _ in range(80):
        if service.poll() is not None: return
        try:
            with urllib.request.urlopen(url + '/api/health', timeout=1): pass
            webbrowser.open(url); return
        except OSError: time.sleep(.25)
if not args.no_browser: threading.Thread(target=open_when_ready, daemon=True).start()
print(f'BA Mate: {url}\nKeep this window open while working. Press Ctrl+C to stop.')
try: service.wait()
except KeyboardInterrupt:
    service.terminate()
    try: service.wait(timeout=10)
    except subprocess.TimeoutExpired: service.kill()
