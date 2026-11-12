import urllib.request
import json

url = 'http://192.168.1.254:3088/api/admin/events?token=wxf_husband_exclusive_token_2026&limit=30'
try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode('utf-8'))
        events = data.get('events', data if isinstance(data, list) else [])
        for e in events[-20:]:
            print(e)
except Exception as err:
    print('Error:', err)

