import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'setServers' not in s:
    s = s.replace("import fs from 'node:fs';", "import fs from 'node:fs';\nimport dns from 'node:dns';", 1)
    # 启动时固定公共 DNS，避开被 Tailscale 劫持的 resolv.conf
    marker = "console.log('BUILD_TAG_20261106B');"
    s = s.replace(marker, "try { dns.setServers(['223.5.5.5', '119.29.29.29']); console.log('[DNS] 使用公共 DNS 解析'); } catch (e) { console.warn('[DNS] 设置失败', e.message); }\n\n" + marker, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('固定 DNS')
