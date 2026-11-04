import io
# ① server：落地第一幕接口
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'opening.js' not in s:
    s = s.replace("import { renameActor, syncNames } from './world/identity.js';",
                  "import { renameActor, syncNames } from './world/identity.js';\nimport { buildOpeningFacts, buildOpeningPrompt } from './world/opening.js';", 1)
    print('引入 opening')

anchor = "    // 0.1 AI 助手专属解耦接口"
block = """    // 0.05 落地第一幕：新人进世界，天道主动开口（只生成一次）
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

        // 写进这个人的聊天历史，作为第一条
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

""" + anchor
if '/api/world/opening' not in s:
    s = s.replace(anchor, block, 1)
    print('① 加落地第一幕接口')
io.open(p, 'w', encoding='utf-8-sig').write(s)
