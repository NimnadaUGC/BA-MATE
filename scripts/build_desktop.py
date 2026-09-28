"""Build on the target OS and CPU architecture; signing is a separate release step."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[1]
NPM = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
if not NPM:
    raise SystemExit('Install Node.js and npm before building the desktop package.')
PYTHON = ROOT / 'backend' / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
if not PYTHON.exists():
    raise SystemExit('Run python3 start.py --setup first.')
def run(args, directory=ROOT):
    subprocess.run([str(x) for x in args], cwd=directory, check=True)
run([NPM, 'ci'], ROOT / 'frontend')
run([NPM, 'run', 'build'], ROOT / 'frontend')
run([PYTHON, '-m', 'pip', 'install', 'pyinstaller==6.22.2'])
run([PYTHON, '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--name', 'ba-mate-service', '--distpath', ROOT / 'build/service', '--workpath', ROOT / 'build/pyinstaller', '--specpath', ROOT / 'build', '--paths', ROOT / 'backend', '--collect-all', 'uvicorn', ROOT / 'backend/desktop_entry.py'])
run([NPM, 'ci'], ROOT / 'desktop')
run([NPM, 'run', 'package' if '--dir' in sys.argv else 'dist'], ROOT / 'desktop')
print('Desktop build created in', ROOT / 'release')
