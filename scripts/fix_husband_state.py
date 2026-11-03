import urllib.request, json

token = 'wxf_husband_exclusive_token_2026'

# 1. 弹掉最后那条省略号 (count=1)
url_pop = f'http://192.168.1.254:3088/api/admin/history/pop?token={token}'
data_pop = json.dumps({'member': 'husband', 'count': 1}).encode('utf-8')
req_pop = urllib.request.Request(url_pop, data=data_pop, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req_pop) as res:
    print('pop result:', res.read().decode('utf-8'))

# 2. 把相公移回临江县衙（yamen）
url_move = f'http://192.168.1.254:3088/api/admin/actor/move?token={token}'
data_move = json.dumps({'id': 'husband', 'place': '临江县衙'}).encode('utf-8')
req_move = urllib.request.Request(url_move, data=data_move, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req_move) as res:
    print('move result:', res.read().decode('utf-8'))
