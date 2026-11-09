import urllib.request
import json

token = 'wxf_husband_exclusive_token_2026'
url = f'http://192.168.1.254:3088/api/admin/world?token={token}'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())

raw_actors = data.get('actors')
print("actors type:", type(raw_actors))
if isinstance(raw_actors, list):
    hus = next((a for a in raw_actors if a.get('id') == 'husband'), {})
    caiyun = [a for a in raw_actors if '采云' in str(a.get('name', ''))]
else:
    hus = raw_actors.get('husband', {})
    caiyun = [a for a in raw_actors.values() if '采云' in str(a.get('name', ''))]

places = data.get('places', {})
if isinstance(places, list):
    places_map = {p.get('id'): p for p in places}
else:
    places_map = places

hus_loc = hus.get('location')
print(f"相公位置: {hus_loc} -> {places_map.get(hus_loc, {}).get('name')}")
for a in caiyun:
    print(f"采云({a.get('id')}): {a.get('location')} -> {places_map.get(a.get('location'), {}).get('name')}")
