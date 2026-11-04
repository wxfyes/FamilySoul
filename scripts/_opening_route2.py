import io
p = 'src/server.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
# 在 "// 0.1 AI 助手..." 之前插入
idx = next(i for i, l in enumerate(lines) if '0.1 AI 助手专属解耦接口' in l)
block = '''  // 0.05 落地第一幕：新人进世界，天道主动开口（只生成一次）
  if (req.method === 'POST' && (pathname === '/api/world/opening' || pathname === '/dsh-surfcore/pet-api/api/world/opening')) {
    try {
      const member = resolveMember(req, url);
      if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效' });
      const actorId = member.actor || member.memberKey;
      const world = loadState(DATA_DIR);
      const a = world.actors?.[actorId];
      if (!a) return sendJson(res, 404, { ok: false, error: '世界里没有这个角色' });
      if (a.opened) return sendJson(res, 200, { ok: true, text: '', done: true });
      if (!llmClient.isReady()) return sendJson(res, 200, { ok: false, error: '天道未就绪' });

      const facts = buildOpeningFacts(world, actorId);
      const { system, user } = buildOpeningPrompt(facts);
      const out = await llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.85, maxTokens: 400 });
      const text = (typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '')).trim();
      if (!text) return sendJson(res, 200, { ok: false, error: '天道没写出第一幕' });

      a.opened = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
      saveState(DATA_DIR, world);

      try {
        const h = petService.readHistory(actorId) || {};
        const msgs = Array.isArray(h.messages) ? h.messages : [];
        msgs.push({ role: 'assistant', text, at: Date.now() });
        petService.saveHistory(actorId, { ...h, messages: msgs });
      } catch { /* 忽略 */ }

      console.log(`[Opening] ${a.name} 落地第一幕已生成（${text.length} 字）`);
      return sendJson(res, 200, { ok: true, text });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

'''
lines = lines[:idx] + block.split('\n') + lines[idx:]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('已插入 route')
