"""Inject existing Actions secret into the server-only proxy configuration."""
import os
import re
import sys
from pathlib import Path
key = os.environ.get('DIFY_API_KEY','')
if not re.fullmatch(r'[A-Za-z0-9_-]{10,200}',key):
    raise SystemExit('DIFY_API_KEY secret missing or malformed')
p=Path(sys.argv[1] if len(sys.argv)>1 else 'workbench-deploy/nginx.conf')
p.write_text(p.read_text().replace('__DIFY_API_KEY__',key))
p.chmod(0o600)
