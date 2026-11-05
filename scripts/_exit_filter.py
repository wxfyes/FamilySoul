import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      console.log(`[ChatTotal] 服务端总耗时 ${Date.now() - t0}ms（成员 ${currentMember.memberKey}）`);"""
new = """      // 出口最后一道：别的真人玩家号不许被 AI 代他说话（按数据判定，不写死名字）
      try {
        const txt = String(result?.reply?.text || '');
        const wOut = loadState(DATA_DIR);
        const meId = currentMember.actor || 'husband';
        const segs = txt.split(/(?=【[^】\\n]{1,12}】)/).filter(Boolean);
        const kept = [];
        for (const seg of segs) {
          const m = seg.match(/^【([^】\\n]{1,12})】/);
          if (!m) { kept.push(seg); continue; }
          const spk = m[1].trim();
          const isRealOther = Object.values(wOut.actors || {}).some(
            (a) => a && !a.dead && a.name === spk && a.id !== meId && /^usr_/.test(String(a.id)),
          );
          if (isRealOther) { console.log(`[Presence:出口] 剔除非本人操控的真人发言：${spk}`); continue; }
          kept.push(seg);
        }
        const merged = kept.join('').trim();
        if (merged && merged !== txt) result.reply.text = merged;
      } catch (e) { /* 忽略 */ }
      console.log(`[ChatTotal] 服务端总耗时 ${Date.now() - t0}ms（成员 ${currentMember.memberKey}）`);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 出口最后一道过滤')
