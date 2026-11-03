import urllib.request, json, sys

url = 'http://192.168.1.254:3088/api/admin/world?token=wxf_husband_exclusive_token_2026'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))
    # 看 actors 里的所有 place
    places_in_actors = set()
    for a in data.get('actors', []):
        if a.get('place'):
            places_in_actors.add(a.get('place'))
    print("Places referenced by actors:")
    for p in sorted(places_in_actors):
        sys.stdout.buffer.write(f"  {p}\n".encode('utf-8'))
