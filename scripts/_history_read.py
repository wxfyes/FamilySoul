import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    if (req.method === 'POST' && pathname === '/api/admin/history/clear') {"
block = """    // 读某个成员最近的聊天记录（诊断用，只读）
    if (req.method === 'GET' && pathname === '/api/admin/history/read') {
      try {
        const member = String(url.searchParams.get('member') || 'husband');
        const limit = Math.min(60, Number(url.searchParams.get('limit')) || 20);
        const h = petService.readHistory(member) || {};
        const msgs = (h.messages || []).slice(-limit).map((m) => ({
          role: m.role, text: String(m.text || '').slice(0, 200), at: m.at || null,
        }));
        return sendJson(res, 200, { ok: true, member, count: msgs.length, messages: msgs });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

""" + anchor
if '/api/admin/history/read' not in s:
    s = s.replace(anchor, block, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加只读历史接口')
