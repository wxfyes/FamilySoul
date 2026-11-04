import io
# ① 服务端：先清洗再存历史、再返回（顺序错了，之前把带标记的原文存进了历史）
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# 找到 history push 与 cleaned 的位置，重排：先清理，再存
old = """      a.opened = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
      saveState(DATA_DIR, world);

      try {
        const h = petService.readHistory(actorId) || {};
        const msgs = Array.isArray(h.messages) ? h.messages : [];
        msgs.push({ role: 'assistant', text, at: Date.now() });
        petService.saveHistory(actorId, { ...h, messages: msgs });
      } catch { /* 忽略 */ }"""
new = """      // 先清洗正文（去掉机器标记），再落历史，免得标记被存下来反复显示
      const cleanText = String(text).replace(/\\[\\[[^\\]]+\\]\\]/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();

      a.opened = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
      saveState(DATA_DIR, world);

      try {
        const h = petService.readHistory(actorId) || {};
        const msgs = Array.isArray(h.messages) ? h.messages : [];
        const speakerMatch0 = cleanText.match(/【([^】]{1,8})】：/);
        msgs.push({
          role: 'assistant',
          text: cleanText,
          speaker: speakerMatch0 ? speakerMatch0[1] : (spawnedName || '旁白'),
          at: Date.now(),
        });
        petService.saveHistory(actorId, { ...h, messages: msgs });
      } catch { /* 忽略 */ }"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 先清洗再存历史')

# 返回也用 cleanText
s = s.replace("""        const cleaned = text.replace(/\\[\\[spawn:[^\\]]+\\]\\]/g, '').trim();
        const speakerMatch = cleaned.match(/【([^】]{1,8})】：/);
        const speaker = speakerMatch ? speakerMatch[1] : (spawnedName || '旁白');
        console.log(`[Opening] ${a.name} 落地第一幕已生成（${cleaned.length} 字，说话人=${speaker}）`);
        return sendJson(res, 200, { ok: true, text: cleaned, speaker, spawned: spawnedName || '' });""",
"""        const speakerMatch = cleanText.match(/【([^】]{1,8})】：/);
        const speaker = speakerMatch ? speakerMatch[1] : (spawnedName || '旁白');
        console.log(`[Opening] ${a.name} 落地第一幕已生成（${cleanText.length} 字，说话人=${speaker}）`);
        return sendJson(res, 200, { ok: true, text: cleanText, speaker, spawned: spawnedName || '' });""", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('② 返回 cleanText')
