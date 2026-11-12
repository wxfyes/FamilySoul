import urllib.request
import json

url = 'http://192.168.1.254:3088/api/admin/logs?token=wxf_husband_exclusive_token_2026'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))
logs = data.get('logs', [])
for l in logs[-50:]:
    if any(k in l for k in ('husband', 'move', '雅间', '货栈', '万花', 'Go', '转场', 'target')):
        print(l)

