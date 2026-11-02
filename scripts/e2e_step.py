import io, os, subprocess, sys, json, time, urllib.request
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

root = os.path.join(os.environ.get('TEMP', '/tmp'), 'fs-e2e-' + str(int(time.time())))
os.makedirs(os.path.join(root, 'data', 'world'), exist_ok=True)
with io.open(os.path.join(root, 'config.json'), 'w', encoding='utf-8') as f:
    f.write(json.dumps({'token': 'test_token_e2e', 'port': 3097, 'world': {'enabled': True, 'msPerWorldHour': 3600000, 'tickIntervalMs': 600000}}, ensure_ascii=False))

server = os.path.abspath('src/server.js')
proc = subprocess.Popen(['node', server], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8')

def call(path, data=None):
    url = 'http://127.0.0.1:3097' + path + '?token=test_token_e2e'
    body = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode('utf-8'))

try:
    for _ in range(40):
        try:
            call('/api/health')
            break
        except Exception:
            time.sleep(1)
    res = call('/api/admin/world/step', {'days': 6})
    print('步进:', res.get('steps'))
    w = call('/api/admin/world')
    print('world day:', w['clock']['day'])
    print('cases:', len(w.get('cases') or []), '| judged:', len([c for c in (w.get('cases') or []) if c.get('status') == 'judged']))
    print('rumors:', len(w.get('rumors') or []))
    print('memorials:', len(w.get('memorials') or []) if 'memorials' in w else '（未在响应里）')
    print('actors:', len(w.get('actors') or []))
    print('treasury:', (w.get('court') or {}).get('treasury'))
finally:
    proc.terminate()
    try:
        out = proc.communicate(timeout=15)[0]
    except Exception:
        proc.kill(); out = ''
    lines = [l for l in (out or '').split('\n') if any(k in l for k in ['Case', 'Court', 'Rumor', '步进', '错误', 'Error', '失败'])]
    print('--- 服务端日志节选 ---')
    print('\n'.join(lines[-15:]))
    import shutil
    shutil.rmtree(root, ignore_errors=True)
