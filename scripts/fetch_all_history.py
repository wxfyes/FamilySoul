import json
import urllib.request
import sys

with open('config.json', 'r', encoding='utf-8') as f:
    cfg = json.load(f)

admin_token = cfg.get('token', '')

url = f"http://192.168.1.254:3088/api/admin/family?token={admin_token}"

try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=5) as res:
        data = json.loads(res.read().decode('utf-8'))
        family = data.get('family', {})
        for k, v in family.items():
            if k != 'liuwenxia': continue
            m_token = v.get('token')
            h_url = f"http://192.168.1.254:3088/dsh-surfcore/pet-api/history?token={m_token}"
            h_req = urllib.request.Request(h_url)
            with urllib.request.urlopen(h_req, timeout=5) as h_res:
                h_data = json.loads(h_res.read().decode('utf-8'))
                msgs = h_data.get('history', [])
                print(f"member={k}, total messages: {len(msgs)}")
                for m in msgs[-10:]:
                    sys.stdout.buffer.write(f"  [{m.get('role')}] {m.get('text')}\n".encode('utf-8'))
except Exception as e:
    print("Error:", e)
