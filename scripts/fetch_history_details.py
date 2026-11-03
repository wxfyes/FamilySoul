import json
import urllib.request
import sys

with open('config.json', 'r', encoding='utf-8') as f:
    cfg = json.load(f)

token = cfg.get('token', '')

url = f"http://192.168.1.254:3088/dsh-surfcore/pet-api/history?token={token}"

try:
    req = urllib.request.Request(url, headers={'x-pet-token': token})
    with urllib.request.urlopen(req, timeout=5) as res:
        data = json.loads(res.read().decode('utf-8'))
        msgs = data.get('messages', [])
        for m in msgs[-10:]:
            role = m.get('role')
            text = m.get('text', '')
            sys.stdout.buffer.write(f"[{role}] {text}\n".encode('utf-8'))
except Exception as e:
    print("Failed to fetch history:", e)

