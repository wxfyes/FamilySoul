import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const namedActors = Object.values(wEnd.actors || {}).filter((a) => {
        if (!a || a.dead || !a.name || a.id === this._viewerActorId) return false;
        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
        return sayText.includes(a.name) || (short && sayText.includes(short));
      });"""
new = """      // 只认"全名"或"非通称的尾名"：别把"掌柜的呢"当成在喊某个姓张的掌柜
      const GENERIC = ['掌柜', '东家', '夫人', '娘子', '小姐', '公子', '老爷', '婆婆', '婶子', '公公', '伙计', '老板', '客官', '大娘子'];
      const namedActors = Object.values(wEnd.actors || {}).filter((a) => {
        if (!a || a.dead || !a.name || a.id === this._viewerActorId) return false;
        if (sayText.includes(a.name)) return true;
        const short = a.name.length > 2 ? a.name.slice(-2) : '';
        if (!short || GENERIC.includes(short)) return false;
        return sayText.includes(short);
      });"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('通称不算点名')
else:
    print('未匹配 namedActors')

@'
import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "      // 一次性：临江的两家客栈并成一家"
add = """      // 一次性：客栈掌柜站到前店柜台（不在后头房间里）
      try {
        if (!world.flags?.innFrontV1) {
          let moved = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (!/客栈掌柜|跑堂|伙计/.test(String(a.role || ''))) continue;
            const pn = String(world.places?.[a.location]?.name || '');
            if (!/客栈/.test(pn) || /柜台/.test(pn)) continue;
            const front = Object.keys(world.places || {}).find((id) => String(world.places[id]?.name || '') === `${pn}·前店柜台`);
            if (front) { a.location = front; moved += 1; }
          }
          world.flags = world.flags || {};
          world.flags.innFrontV1 = { at: Date.now(), moved };
          if (moved) console.log(`[Inn] 掌柜上前柜台：${moved} 人`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'innFrontV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('掌柜上前台')
