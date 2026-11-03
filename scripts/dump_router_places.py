import urllib.request, json, sys

url = 'http://192.168.1.254:3088/api/admin/world?token=wxf_husband_exclusive_token_2026'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))
    # 查找包含 places 的键
    for k, v in data.items():
        if isinstance(v, dict) and ('yamen' in v or 'street' in v or 'tea_house' in v):
            print(f"Places found in key '{k}':")
            for pk, pv in v.items():
                pname = pv.get('name', '') if isinstance(pv, dict) else str(pv)
                sys.stdout.buffer.write(f"  {pk}: {pname}\n".encode('utf-8'))
            break
        elif isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict) and 'name' in v[0] and 'exits' in v[0]:
            print(f"Places found in list '{k}':")
            for it in v:
                sys.stdout.buffer.write(f"  {it.get('id')}: {it.get('name')}\n".encode('utf-8'))
            break

