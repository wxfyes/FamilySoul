import urllib.request
import json

token = 'wxf_husband_exclusive_token_2026'
url = f'http://192.168.1.254:3088/api/admin/world?token={token}'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())

silver = data.get('assets', {}).get('silver')
print(f"=== 软路由当前 assets.silver: {silver} ===")

ledger = data.get('ledger', [])
print(f"=== 流水账最近 8 条 ===")
for x in ledger[-8:]:
    print(f"第{x.get('day')}日{x.get('hour')}时 | {x.get('title')} | {x.get('delta')}两 | 记账时结余: {x.get('balance')}两")

