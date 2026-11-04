import urllib.request, json

token = 'wxf_husband_exclusive_token_2026'

url_pop = f'http://192.168.1.254:3088/api/admin/history/pop?token={token}'
data_pop = json.dumps({'member': 'husband', 'count': 2}).encode('utf-8')
req_pop = urllib.request.Request(url_pop, data=data_pop, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req_pop) as res:
    print('pop result:', res.read().decode('utf-8'))

