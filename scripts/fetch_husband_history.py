import urllib.request, json, sys

with open('config.json', 'r', encoding='utf-8') as f:
    cfg = json.load(f)
token = cfg.get('token', '')

url = f'http://192.168.1.254:3088/api/admin/family?token={token}'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))
    h_token = data.get('family', {}).get('husband', {}).get('token')

h_url = f'http://192.168.1.254:3088/dsh-surfcore/pet-api/history?token={h_token}'
h_req = urllib.request.Request(h_url)
with urllib.request.urlopen(h_req) as h_res:
    data = json.loads(h_res.read().decode('utf-8'))
    msgs = data.get('history', [])
    for m in msgs[-2:]:
        sys.stdout.buffer.write(f"[{m.get('role')}] {m.get('text')}\n".encode('utf-8'))

