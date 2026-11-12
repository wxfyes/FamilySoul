import urllib.request
import json

base = 'http://192.168.1.254:3088'
token = 'wxf_husband_exclusive_token_2026'

def get_json(path):
    url = f"{base}{path}?token={token}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.loads(res.read().decode('utf-8'))

# 1. 查看 zhanjing 的详细数据
print("--- ZHANJING ---")
try:
    zj = get_json('/api/admin/actor/detail') # or pass id
except Exception as e:
    pass

url = f"{base}/api/admin/world?token={token}"
req = urllib.request.Request(url)
with urllib.request.urlopen(req, timeout=10) as res:
    data = json.loads(res.read().decode('utf-8'))

for a in data.get('actors', []):
    if a.get('id') in ('zhanjing', 'waner', 'husband'):
        print(f"Actor {a.get('id')}: name={a.get('name')}, role={a.get('role')}, rel={a.get('relations')}, intimacy={a.get('intimacy')}, bondsWithHusband={a.get('bondsWithHusband')}")

# 2. 查看 milestones
print("\n--- MILESTONES / MEMORIES WITH 静儿 ---")
# 查看大事记
mem_url = f"{base}/api/admin/memories?token={token}"
try:
    with urllib.request.urlopen(urllib.request.Request(mem_url), timeout=10) as res:
        mems = json.loads(res.read().decode('utf-8'))
        print(f"Memories total: {len(mems.get('memories', []))}")
        for m in mems.get('memories', []):
            txt = str(m.get('text', '')) + str(m.get('desc', '')) + str(m.get('content', ''))
            if '静' in txt or '随' in txt or '书吏' in txt:
                print("Memory:", m)
except Exception as e:
    print("Memories error:", e)

