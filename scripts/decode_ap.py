import urllib.request, json, sys

url = 'http://192.168.1.254:3088/api/admin/world?token=wxf_husband_exclusive_token_2026'
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode('utf-8'))
    for ap in data.get('appointments', []):
        name = ap.get('name', '')
        day = ap.get('day', '')
        hour = ap.get('hour', '')
        place = ap.get('place', '')
        text = ap.get('text', '')
        sys.stdout.buffer.write(f"Appointment: {name} (day={day}, hour={hour}, place={place}): {text}\n".encode('utf-8'))

