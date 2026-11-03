import json
import urllib.request
import sys

with open('config.json', 'r', encoding='utf-8') as f:
    cfg = json.load(f)

token = cfg.get('token', '')

url = f"http://192.168.1.254:3088/api/admin/logs?token={token}"

try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=5) as res:
        data = json.loads(res.read().decode('utf-8'))
        logs = data.get('logs', [])
        for l in logs[-80:]:
            sys.stdout.buffer.write((l + '\n').encode('utf-8'))
except Exception as e:
    print("Failed to fetch logs:", e)
