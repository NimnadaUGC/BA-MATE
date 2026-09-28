"""Create a source package without local workspaces, credentials or dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
ROOT = Path(__file__).resolve().parents[1]
release = ROOT / 'release'
release.mkdir(exist_ok=True)
target = release / 'BA-Mate-0.4.0-source.zip'
excluded = {'node_modules', '.venv', '__pycache__', 'tmp', 'build', 'release', '.git'}
with ZipFile(target, 'w', ZIP_DEFLATED) as package:
    for path in ROOT.rglob('*'):
        relative = path.relative_to(ROOT)
        if not path.is_file() or any(part in excluded for part in relative.parts): continue
        if path.name.startswith('.env') or path.name == '.DS_Store' or '.sqlite3' in path.name: continue
        if relative.parts[0] == 'docs' and path.suffix.lower() in {'.pdf', '.png', '.svg'}: continue
        package.write(path, Path('BA_MATE') / relative)
    framework = ROOT.parent / 'Framework/Diagrams/BA Framework v3.mmd'
    package.write(framework, 'Framework/Diagrams/BA Framework v3.mmd')
print(target)
