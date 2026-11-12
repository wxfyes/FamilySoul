import urllib.request
import json

url = 'http://192.168.1.254:3088/api/admin/world?token=wxf_husband_exclusive_token_2026'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))

# 查看 suyingxue 的具体 location 字段
# 找一个直接读取原版 state.json 的接口
admin_url = 'http://192.168.1.254:3088/api/admin/actor/detail?token=wxf_husband_exclusive_token_2026&id=suyingxue'
req2 = urllib.request.Request(admin_url)
try:
    with urllib.request.urlopen(req2) as res2:
        print("Suyingxue detail:", res2.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)

admin_h = 'http://192.168.1.254:3088/api/admin/actor/detail?token=wxf_husband_exclusive_token_2026&id=husband'
req3 = urllib.request.Request(admin_h)
try:
    with urllib.request.urlopen(req3) as res3:
        print("Husband detail:", res3.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)

