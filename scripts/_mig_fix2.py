import io

# ============ ③ 心跳定名：await 期间不留旧 world，回来重新 loadState 增量合并 ============
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find('  async function processMigrants() {')
end = s.find('\n  }\n', start)
if start < 0 or end < 0:
    raise SystemExit('定位 processMigrants 失败')

new_fn = '''  async function processMigrants() {
    try {
      // 第一段：只读，取出待定名的人（读完就丢，不在这份 world 上写）
      const snapshot = peek(DATA_DIR);
      const pending = Array.isArray(snapshot.pendingMigrants) ? snapshot.pendingMigrants.slice() : [];
      if (!pending.length) return;
      const today = Number(snapshot.clock?.day) || 1;

      const staleIds = pending.filter((m) => m && today - Number(m.day) >= 3).map((m) => m.id);
      const fresh = pending.filter((m) => m && !m.asked).slice(0, 3);

      let named = [];
      if (petService.llmClient?.isReady?.() && fresh.length) {
        const list = fresh.map((m, i) => `${i + 1}. ${m.role}（${m.gender === 'female' ? '女' : '男'}，约${m.age}岁，${m.cause === 'refugee' ? '逃荒来的' : m.cause === 'merchant' ? '行商' : m.cause === 'bride' ? '投亲' : '投工'}）`).join('\\n');
        const system = '你是这个世界的天道，为刚进城的人定名与来历。只输出 JSON，不要解释。';
        const user = `第${today}日，临江府来了这些人：\\n${list}\\n\\n请给每个人取一个合乎古代身份的名字，并写一句来历（20字以内）。\\n输出：{"people":[{"index":1,"name":"张三","age":32,"background":"淮北逃荒来的，带着一个孩子"}]}`;
        try {
          const out = await petService.llmClient.complete({ system, messages: [{ role: 'user', content: user }], temperature: 0.8, maxTokens: 400 });
          const text = typeof out === 'string' ? out : (out?.text || out?.content || '');
          const m = text.match(/\\{[\\s\\S]*\\}/);
          if (m) {
            const data = JSON.parse(m[0]);
            named = (data.people || []).map((p) => ({ pmId: fresh[Number(p.index) - 1]?.id, name: p.name, age: p.age, background: p.background }))
              .filter((x) => x.pmId);
          }
        } catch (e) { console.warn('[Migrate] 天道定名失败：', e.message); }
      }

      // 第二段：异步结束之后重新读盘，再把结果合并进去（绝不用旧 world 覆盖）
      const world = loadState(DATA_DIR);
      world.pendingMigrants = Array.isArray(world.pendingMigrants) ? world.pendingMigrants : [];
      const byId = new Map(world.pendingMigrants.map((m) => [m.id, m]));

      // 1) 天道定名的
      for (const item of named) {
        const pm = byId.get(item.pmId);
        if (!pm) continue;
        const a = materializeMigrant(world, pm, { name: item.name, age: item.age, background: item.background });
        if (a) {
          console.log(`[Migrate] 天道定名：${a.name}（${pm.role}）${item.background || ''}`);
          world.pendingMigrants = world.pendingMigrants.filter((x) => x.id !== pm.id);
        }
      }

      // 2) 标记已问过（只标记真正问过、且还没落下的）
      if (fresh.length) {
        for (const pm of world.pendingMigrants) {
          if (fresh.some((f) => f.id === pm.id) && !named.some((n) => n.pmId === pm.id)) pm.asked = true;
        }
      }

      // 3) 等了三天还没定名的：引擎兜底落下
      for (const id of staleIds) {
        const pm = byId.get(id);
        if (!pm) continue;
        const a = materializeMigrant(world, pm, { name: fallbackName(world, pm.gender) });
        if (a) {
          console.log(`[Migrate] 兜底落下 ${a.name}（${pm.role}）`);
          world.pendingMigrants = world.pendingMigrants.filter((x) => x.id !== pm.id);
        } else {
          // 名字实在取不出：放宽为不重名即可，丢弃这条，避免无限挂起
          world.pendingMigrants = world.pendingMigrants.filter((x) => x.id !== pm.id);
        }
      }

      saveState(DATA_DIR, world);
    } catch (err) {
      console.warn('[Migrate] 来客处理失败：', err.message);
    }
  }

'''

s = s[:start] + new_fn + s[end:]
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('③ 重写 processMigrants：读→等→重新读盘合并')
