import urllib.request
import json

base = 'http://192.168.1.254:3088'
token = 'wxf_husband_exclusive_token_2026'

# 读取软路由 state.json
req = urllib.request.Request(f"{base}/api/admin/world?token={token}")
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))

# 我们把 memory.js 逻辑拿来测试
from urllib.request import urlopen
mems_data = json.loads(urlopen(f"{base}/api/admin/memories?token={token}").read().decode('utf-8'))
mems = mems_data.get('memories', [])
print(f"Total memories in world: {len(mems)}")

# 查 about 包含 waner 的所有记忆
waner_mems = [m for m in mems if 'waner' in m.get('about', []) or '沈婉儿' in m.get('text', '') or '婉儿' in m.get('text', '')]
print(f"Memories with waner: {len(waner_mems)}")
print("\nLast 15 waner memories:")
for m in waner_mems[-15:]:
    print(f"- {m.get('text')}")

