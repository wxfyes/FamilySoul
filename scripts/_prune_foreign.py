import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 宅院巡检不再碰商业与衙署
old = """    const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);"""
new = """    // 商业与衙署有自己的模板，宅院不要插手
    if (premisesKind(p.name) || /衙|仓|庙|观|寺|学|院$/.test(String(p.name || ''))) continue;
    const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 宅院不碰商业与衙署')

# ② 清掉"串模板"的房间
if 'export function pruneForeignRooms' not in s:
    s = s.rstrip() + '''

/**
 * 清掉"串了模板"的房间：酒楼里不该有正房，衙署里不该有灶房。
 * @returns {number} 清掉的房间数
 */
export function pruneForeignRooms(world) {
  let removed = 0;
  for (const [pid, p] of Object.entries(world?.places || {})) {
    if (!p || !p.rooms || p.parent) continue;
    const name = String(p.name || '');
    let allowed = null;
    const kind = premisesKind(name);
    if (kind) allowed = new Set(PREMISES[kind].map((r) => r.key));
    else if (/衙|县衙|府衙|公堂/.test(name)) allowed = new Set(COURT.map((r) => r.key));
    else if (p.grade || p.residence) continue;
    if (!allowed) continue;
    for (const [key, r] of Object.entries(p.rooms)) {
      if (allowed.has(key)) continue;
      if (r?.id && world.places[r.id]) delete world.places[r.id];
      delete p.rooms[key];
      removed += 1;
    }
  }
  return removed;
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('② 加 pruneForeignRooms')

# ③ 巡检里先清串模板
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("  pruneRunawayRooms(world);", "  pruneRunawayRooms(world);\n  pruneForeignRooms(world);")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('③ 巡检先清串模板')
