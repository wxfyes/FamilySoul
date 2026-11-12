import urllib.request
import json

url = 'http://192.168.1.254:3088/dsh-surfcore/pet-api/history?token=wxf_husband_exclusive_token_2026&limit=15'
try:
    res = urllib.request.urlopen(url, timeout=10)
    data = json.loads(res.read().decode('utf-8'))
    history = data.get('history', [])
    for m in history:
        print(f"[{m.get('role')}]: {m.get('text')}\n")

    # 查看当前相公位置和状态
    me_url = 'http://192.168.1.254:3088/api/me?token=wxf_husband_exclusive_token_2026'
    me_data = json.loads(urllib.request.urlopen(me_url, timeout=10).read().decode('utf-8'))
    print("Husband Location:", me_data.get('location'), me_data.get('placeName'))
except Exception as e:
    print("Error:", e)

