import urllib.request, json, sys

with open('config.json', 'r', encoding='utf-8') as f:
    cfg = json.load(f)
token = cfg.get('token', '')

url = f'http://192.168.1.254:3088/api/admin/world?token={token}'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))
    for a in data.get('actors', []):
        if a.get('id') in ['zhanjing', 'husband']:
            sys.stdout.buffer.write(f"{a.get('id')} {a.get('name')} place={a.get('place')}\n".encode('utf-8'))

