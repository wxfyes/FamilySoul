import urllib.request, json, sys

url = 'http://192.168.1.254:3088/api/admin/world?token=wxf_husband_exclusive_token_2026'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))
    for a in data.get('actors', []):
        if a.get('id') in ('husband', 'zhanjing'):
            sys.stdout.buffer.write(f"{a.get('id')}: {a.get('name')} @ {a.get('place')}\n".encode('utf-8'))
