import urllib.request, json

token = 'wxf_husband_exclusive_token_2026'

# 1. 查阅并修复 husband 的 home 和 location
url = f'http://192.168.1.254:3088/api/admin/actor/detail?token={token}&id=husband'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))
    print('Current husband:', data.get('actor'))

# 用 admin 接口直接重设 husband.home 为 tea_house
url_reset = f'http://192.168.1.254:3088/api/admin/relocate?token={token}'
# 看看 server.js 里有什么端点可以改 actor

