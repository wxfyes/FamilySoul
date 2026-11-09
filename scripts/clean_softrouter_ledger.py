import urllib.request
import json

token = 'wxf_husband_exclusive_token_2026'
url = f'http://192.168.1.254:3088/api/admin/world?token={token}'

# 1. 获取软路由当前数据
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())

silver = data.get('assets', {}).get('silver', 0)
print(f"清理前 assets.silver: {silver}")

# 2. 治理流水：只保留第一条定金
ledger = data.get('ledger', [])
new_ledger = []
deposit_seen = False

for item in ledger:
    title = item.get('title', '')
    if any(k in title for k in ['汪总商', '汪府', '总商府', '汪家', '寿宴定']):
        if not deposit_seen:
            item['title'] = '扬州盐帮汪总商寿宴定金'
            new_ledger.append(item)
            deposit_seen = True
        else:
            print(f"删除重复定金流水: {title} {item.get('delta')}两")
    else:
        new_ledger.append(item)

data['ledger'] = new_ledger

# 3. 校准资产：从 11087.67 调整为 10937.67（扣除多加的 150 两）
target_silver = 10937.67
data['assets']['silver'] = target_silver

# 4. 确保立项 110 两尾款字据
promises = data.get('promises', [])
has_balance_promise = any(p.get('orderBalance') == 110 for p in promises)
if not has_balance_promise:
    promises.append({
        'id': f'bal_{data.get("clock", {}).get("day", 20)}_wang',
        'text': '运河大酒楼·汪总商寿宴余款',
        'orderBalance': 110,
        'from': 'wang_zongshang',
        'due': data.get('clock', {}).get('day', 20) + 1,
        'at': data.get('clock', {}).get('day', 20),
        'done': False
    })
    data['promises'] = promises
    print("立项 110 两尾款债权字据！")

# 5. 回写软路由
save_url = f'http://192.168.1.254:3088/api/admin/world?token={token}'
post_data = json.dumps(data).encode('utf-8')
save_req = urllib.request.Request(save_url, data=post_data, headers={'Content-Type': 'application/json'}, method='POST')
with urllib.request.urlopen(save_req) as res:
    result = json.loads(res.read())
    print("回写软路由结果:", result)

print(f"清理后 assets.silver: {target_silver} 两已精准平账！")

