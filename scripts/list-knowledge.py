import os
from pathlib import Path
import requests

def load_env(file):
    p = Path(file)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key,value=line.split('=',1)
        os.environ.setdefault(key.strip(), value.strip())

root = Path(__file__).resolve().parent.parent
load_env(root/'.env.local')
load_env('.env.local')

url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
if not url or not key:
    raise SystemExit('Missing env')

resp = requests.get(f"{url}/rest/v1/knowledge_chunks?select=id,slug,title,content", headers={
    'apikey': key,
    'Authorization': f'Bearer {key}'
})
if not resp.ok:
    print(resp.text)
    resp.raise_for_status()

records = resp.json()
print(f"Total records: {len(records)}")
for rec in records:
    print('\n---')
    print(rec['id'], rec['slug'])
    print(rec['title'])
    print(rec['content'][:400].replace('\n',' '), '...')
