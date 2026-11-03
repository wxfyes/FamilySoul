import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 9.27 三道自检 GET /api/admin/audit"
inject = (
    "    // 9.23 自更新 POST /api/admin/self-update {url} —— 只覆盖代码，绝不动 data/\n"
    "    if (req.method === 'POST' && pathname === '/api/admin/self-update') {\n"
    "      try {\n"
    "        const body = await parseJsonBody(req, 64 * 1024);\n"
    "        const url = String(body.url || 'http://192.168.1.112:8089/update.tar.gz');\n"
    "        const root = process.cwd();\n"
    "        const script = [\n"
    "          'set -e',\n"
    "          'TMP=/tmp/fs-update-$$',\n"
    "          'mkdir -p $TMP',\n"
    "          `wget -q -O $TMP/u.tgz '${url}'`,\n"
    "          'tar -xzf $TMP/u.tgz -C $TMP',\n"
    "          // 只同步代码与脚本，data/ 世界数据一律不动\n"
    "          `for d in src web scripts docs mobile; do if [ -d $TMP/$d ]; then rm -rf '${root}'/$d && cp -r $TMP/$d '${root}'/$d; fi; done`,\n"
    "          `for f in package.json index.html '*.sh'; do true; done`,\n"
    "          `cp -f $TMP/package.json '${root}'/package.json 2>/dev/null || true`,\n"
    "          `cp -f $TMP/*.sh '${root}'/ 2>/dev/null || true`,\n"
    "          `chmod +x '${root}'/*.sh 2>/dev/null || true`,\n"
    "          `cd '${root}'`,\n"
    "          './stop.sh || true',\n"
    "          'sleep 1',\n"
    "          './start.sh',\n"
    "        ].join(' && ');\n"
    "        const { spawn } = await import('node:child_process');\n"
    "        const child = spawn('sh', ['-c', script], { detached: true, stdio: 'ignore', cwd: '/tmp' });\n"
    "        child.unref();\n"
    "        console.log(`[SelfUpdate] 已启动自更新（不含 data/）：${url}`);\n"
    "        return sendJson(res, 200, { ok: true, started: true, note: '约 10 秒后重启，只更新代码不动世界数据' });\n"
    "      } catch (err) {\n"
    "        return sendJson(res, 500, { ok: false, error: err.message });\n"
    "      }\n"
    "    }\n\n"
    "    // 9.27 三道自检 GET /api/admin/audit"
)
if anchor in s and '/api/admin/self-update' not in s:
    s = s.replace(anchor, inject, 1)
    print('added self-update endpoint')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
