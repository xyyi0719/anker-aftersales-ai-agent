"""The CI artifact and local ZIP use the same explicit file allowlist."""
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT/'release'; DEST.mkdir(exist_ok=True)
files=[]
for name in ['mock_apis','retrieval','knowledge_base','chatflow','docker','deploy','docs','scripts','tests','frontend/dist']:
    files += [p for p in (ROOT/name).rglob('*') if p.is_file() and '__pycache__' not in p.parts and not p.name.endswith(('.sqlite3','.pyc')) and not p.name.startswith('.env')]
files += [ROOT/p for p in ['README.md','requirements-test.txt','pytest.ini']]
manifest={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
try: revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
except subprocess.CalledProcessError: revision='unknown'
with zipfile.ZipFile(DEST/'anker-aftersales-release.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(files): z.write(p,'anker-aftersales/'+str(p.relative_to(ROOT)))
    z.writestr('anker-aftersales/MANIFEST.json',json.dumps(dict(base_revision=revision,files=manifest),indent=2))
path=DEST/'anker-aftersales-release.zip'
(DEST/'SHA256SUMS').write_text(hashlib.sha256(path.read_bytes()).hexdigest()+'  '+path.name+'\n')
print(path)
