import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = next(i for i, l in enumerate(lines) if '未找到对应接口' in l)
block = '''  // 调试：看某账号最近几条对话（只读，不落盘）
  if (req.method === 'GET' && pathname === '/api/admin/chat-tail') {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const key = String(url.searchParams.get('key') || 'husband');
      const h = petService.readHistory(key) || {};
      const msgs = (Array.isArray(h.messages) ? h.messages : []).slice(-8).map((m) => ({
        role: m.role, speaker: m.speaker || '', text: String(m.text || '').slice(0, 200), at: m.at || 0,
      }));
      return sendJson(res, 200, { ok: true, key, msgs });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines.insert(idx, block)
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('加 chat-tail 调试接口')
