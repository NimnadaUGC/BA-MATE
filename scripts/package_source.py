"""Create an explicitly scoped source package; do not overwrite an existing ZIP."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'release' / 'BA-Mate-0.4.0-source.zip', help='New ZIP path; existing files are never overwritten')
args = parser.parse_args()
target = args.output.expanduser().resolve()
target.parent.mkdir(parents=True, exist_ok=True)

# Only include application source and selected distribution documentation.
# Project data, local audit evidence, generated builds and arbitrary workspace
# files must be reviewed separately before any distribution.
files = [
    'README.md', 'LICENSE', 'start.py', 'Start BA Mate.bat', 'Start BA Mate.command',
    'backend/requirements.txt', 'backend/desktop_entry.py',
    'frontend/index.html', 'frontend/package.json', 'frontend/package-lock.json', 'frontend/tsconfig.json',
    'desktop/main.cjs', 'desktop/preload.cjs', 'desktop/package.json', 'desktop/package-lock.json',
    'research-service/README.md', 'research-service/schema.sql', 'research-service/config.example.php',
    'docs/README.md', 'docs/PILOT_GUIDE.md', 'docs/MODEL_INTEGRATION_HANDOFF.md',
    'docs/PROJECT_SETUP_AND_BACKGROUND_WORK.md', 'docs/TOKEN_MANAGEMENT.md',
    'scripts/build_desktop.py', 'scripts/package_source.py',
]
patterns = {
    'backend/app': ('*.py',), 'backend/tests': ('*.py',),
    'frontend/src': ('*.ts', '*.tsx', '*.css'),
    'frontend/public/fonts': ('*.woff2', '*.txt', '*.md'),
    'research-service/public': ('*.php', '.htaccess'), 'research-service/scripts': ('*.php',),
}
files.append('frontend/public/bamate_logo.png')
for folder, allowed in patterns.items():
    base = ROOT / folder
    for pattern in allowed:
        files.extend(str(path.relative_to(ROOT)) for path in base.rglob(pattern) if path.is_file() and '__pycache__' not in path.parts)
missing = [name for name in files if not (ROOT / name).is_file()]
if missing:
    raise SystemExit('Cannot create source package; required files are missing: ' + ', '.join(missing))
try:
    with ZipFile(target, 'x', ZIP_DEFLATED) as package:
        package.writestr('BA_MATE/SOURCE_PACKAGE_README.txt', '''BA Mate source package

Start with python3 start.py --setup, then python3 start.py.
Python and Node.js requirements are in README.md. This package includes selected
source and guides only. Repository-only research, historical audit and hosting
documents are excluded, so some links in README.md and docs/README.md will not
resolve here. Existing desktop builds and user projects are not included.

Review the source and included guides before sharing: this packaging script does
not scan source files for secrets or establish suitability for distribution.
''')
        for name in sorted(set(files)):
            package.write(ROOT / name, Path('BA_MATE') / name)
except FileExistsError:
    raise SystemExit(f'Refusing to overwrite existing package: {target}. Choose a new --output path.')
print(target)
