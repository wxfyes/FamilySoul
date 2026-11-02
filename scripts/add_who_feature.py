import io

# ① 服务端：/api/who 行踪
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "  // ── 管理控制台专属 API ──────────────────────────────────────"
inject = (
    "  // ── 行踪簿：谁在哪（只给名字/身份/所在，不给私事）──────\n"
    "  if (req.method === 'GET' && pathname === '/api/who') {\n"
    "    try {\n"
    "      const member = resolveMember(req, url);\n"
    "      if (!member) return sendJson(res, 401, { ok: false, error: '无效令牌' });\n"
    "      const q = String(url.searchParams.get('q') || '').trim();\n"
    "      const world = peek(DATA_DIR);\n"
    "      const actorId = member.actor || null;\n"
    "      const me = actorId ? world.actors?.[actorId] : world.actors?.husband;\n"
    "      const rows = Object.values(world.actors || {})\n"
    "        .filter((a) => a && !a.dead && a.id !== actorId && a.id !== 'husband')\n"
    "        .filter((a) => (q ? String(a.name || '').includes(q) || String(a.role || '').includes(q) : true))\n"
    "        .map((a) => ({\n"
    "          name: a.name,\n"
    "          role: a.role || '',\n"
    "          place: String(world.places?.[a.location]?.name || '不知去向'),\n"
    "          here: a.location && me?.location ? a.location === me.location : false,\n"
    "          trust: Number(a.relations?.husband?.trust) || 0,\n"
    "        }))\n"
    "        .sort((x, y) => (y.here - x.here) || (y.trust - x.trust))\n"
    "        .slice(0, 60);\n"
    "      return sendJson(res, 200, { ok: true, myPlace: String(world.places?.[me?.location]?.name || ''), rows });\n"
    "    } catch (err) {\n"
    "      return sendJson(res, 500, { ok: false, error: err.message });\n"
    "    }\n"
    "  }\n\n"
    "  // ── 管理控制台专属 API ──────────────────────────────────────"
)
if anchor in s and '/api/who' not in s:
    s = s.replace(anchor, inject, 1)
    print('added /api/who')
else:
    print('WARN: admin anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)

# ② 看板：行踪卡
p2 = 'web/dashboard.html'
s2 = io.open(p2, encoding='utf-8-sig').read()
if 'id="who"' not in s2:
    s2 = s2.replace(
        "  <section class=\"card\">\n    <h2>朝中（官职）</h2>",
        "  <section class=\"card\">\n"
        "    <h2>行踪（谁在哪）</h2>\n"
        "    <div class=\"row\"><input id=\"whoQ\" placeholder=\"搜名字/身份\" style=\"flex:1;background:#1e222b;color:#e8eaee;border:1px solid #2a2f3a;border-radius:8px;padding:5px 8px\"><button onclick=\"whoSearch()\">查</button></div>\n"
        "    <div id=\"who\" style=\"margin-top:8px\">—</div>\n"
        "  </section>\n\n"
        "  <section class=\"card\">\n    <h2>朝中（官职）</h2>",
        1,
    )
    print('added who card')

if 'function whoSearch' not in s2:
    fn = (
        "async function whoSearch() {\n"
        "  const tk = token();\n"
        "  const q = ($('whoQ')?.value || '').trim();\n"
        "  if (!tk) return;\n"
        "  try {\n"
        "    const r = await fetch(`/api/who?token=${encodeURIComponent(tk)}&q=${encodeURIComponent(q)}`);\n"
        "    const j = await r.json();\n"
        "    const rows = j.rows || [];\n"
        "    $('who').innerHTML = rows.length\n"
        "      ? rows.map((x) => `<div class=\"row\"><span>${x.here ? '📍 ' : ''}<b>${x.name}</b> <span class=\"muted\">${x.role}</span></span><span class=\"muted\">${x.place}</span></div>`).join('')\n"
        "      : '<div class=\"muted\">没找到</div>';\n"
        "  } catch (e) { $('who').innerHTML = '<div class=\"muted\">查询失败</div>'; }\n"
        "}\n\n"
    )
    s2 = s2.replace("async function todoRemove(", fn + "async function todoRemove(", 1)
    print('added whoSearch')

if "whoSearch();" not in s2.split('function whoSearch')[0]:
    s2 = s2.replace("  // ── 成员绑定 ──────────────────────────────", "  try { whoSearch(); } catch (e) {}\n\n  // ── 成员绑定 ──────────────────────────────", 1)
    print('added who auto load')

io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
