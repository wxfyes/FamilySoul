import json
import urllib.request

with open('config.json', 'r', encoding='utf-8') as f:
    cfg = json.load(f)
token = cfg.get('token', '')

url = f'http://192.168.1.254:3088/api/admin/world?token={token}'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))
    actors = data.get('actors', [])
    for a in actors:
        if a.get('id') in ['husband', 'liuwenxia'] or '于' in a.get('name', ''):
            print(a.get('id'), a.get('name'), 'loc=', a.get('location'), a.get('placeName'))
