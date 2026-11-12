import urllib.request
import json

base = 'http://192.168.1.254:3088'
token = 'wxf_husband_exclusive_token_2026'

def move(aid, place):
    url = f"{base}/api/admin/actor/move?token={token}"
    data = json.dumps({'id': aid, 'place': place}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=10) as res:
        print(f"Move {aid} -> {place}:", res.read().decode('utf-8'))

move('husband', '万花楼·二层温香雅阁')
move('suyingxue', '万花楼·二层温香雅阁')

