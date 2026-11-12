import urllib.request
import json

url = 'http://192.168.1.254:3088/api/admin/world?token=wxf_husband_exclusive_token_2026'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))

actors = data.get('actors', [])
places = data.get('places', [])

for a in actors:
    if a.get('id') in ('husband', 'suyingxue', 'yangcaiyun'):
        print(f"Actor: {a.get('id')} ({a.get('name')}) @ {a.get('place')} [locId: {a.get('locationId') or a.get('location')}]")

print("\n--- Places with 翟 or 万花 or 雅间 or 货栈 ---")
for p in places:
    name = str(p.get('name', ''))
    if any(k in name for k in ('翟', '万花', '雅间', '货栈')):
        print(f"Place: {p.get('id')} -> {name} (parent: {p.get('parent')})")
