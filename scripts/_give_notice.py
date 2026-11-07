import io
p = 'src/world/chat-actions.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const who = findByName(world, mGive[1]);
      if (who && who.location === me.location) {
        const it = findItem(world, me.id, mGive[2]) || itemsOf(world, me.id).find((x) => mGive[2].includes(x.name.slice(-2)));
        if (it) {
          const r = giveItem(world, me.id, who.id, it.id);
          if (r.ok) notices.push(r.line.replace(/^（|）$/g, ''));
        } else {
          notices.push(`（你手里没有「${mGive[2]}」这件东西。）`);
        }
      }"""
new = """      const who = findByName(world, mGive[1]);
      if (!who) {
        notices.push(`（没找到「${mGive[1]}」这个人。）`);
      } else if (who.location !== me.location) {
        notices.push(`（${who.name}不在跟前，东西递不过去。）`);
      } else {
        const it = findItem(world, me.id, mGive[2]) || itemsOf(world, me.id).find((x) => mGive[2].includes(x.name.slice(-2)));
        if (it) {
          const r = giveItem(world, me.id, who.id, it.id);
          if (r.ok) notices.push(r.line.replace(/^（|）$/g, ''));
        } else {
          notices.push(`（你手里没有「${mGive[2]}」这件东西。）`);
        }
      }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('给东西补提示')
