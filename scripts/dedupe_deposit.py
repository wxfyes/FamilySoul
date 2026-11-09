import urllib.request
import json

token = 'wxf_husband_exclusive_token_2026'
# 1. 读取当前 state
url_get = f'http://192.168.1.254:3088/api/admin/world?token={token}'
req_get = urllib.request.Request(url_get)
with urllib.request.urlopen(req_get) as res:
    world = json.loads(res.read())

ledger = world.get('ledger', [])
print("当前 ledger 长度:", len(ledger))

# 找出重复的那条汪家定金（保留一条标准标题的，删掉一条重复的）
wang_entries = [i for i, x in enumerate(ledger) if '汪' in x.get('title', '')]
print("汪总商相关流水索引:", wang_entries)

if len(wang_entries) >= 2:
    # 删掉重复的第二条
    drop_idx = wang_entries[-1]
    dropped = ledger.pop(drop_idx)
    print(f"删除重复流水: {dropped}")
    # 校准 silver 为 10937.67 (只算一笔50两定金)
    world['assets']['silver'] = 10937.67
    
    # 写入软路由
    url_save = f'http://192.168.1.254:3088/api/admin/grant?token={token}'
    # 通过直接调用 admin 接口或者写回
    # 检查是否有直接写回 world 的接口，没有的话我们看 server.js 的接口

