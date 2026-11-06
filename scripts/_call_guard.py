import io
p = 'src/world/chat-actions.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "  // 叫人来（单人 / 都来）"
add = """  // 叫护院家丁（当差的）：从宅里各处提到议事厅
  if (/(护院|家丁|当差|当值|门房)/.test(say) && /(叫|来|进来|传|提|人呢)/.test(say)) {
    const hall = hallOf(world);
    const hereName = String(world.places?.[me.location]?.name || '');
    const estate = hereName.includes('·') ? hereName.split('·').slice(0, 2).join('·') : '';
    const names = [];
    for (const a of Object.values(world.actors || {})) {
      if (!a || a.dead || a.id === me.id) continue;
      if (!isOuterStaff(a)) continue;
      const pn = String(world.places?.[a.location]?.name || '');
      const hn = String(world.places?.[a.home]?.name || '');
      if (!(pn.startsWith(estate) || hn.startsWith(estate))) continue;
      if (a.location === hall) { names.push(`${a.name}（厅上）`); continue; }
      const mv = hall ? moveActor(world, a.id, hall, 'world', '厅上候令') : { ok: false };
      if (mv?.ok) names.push(`${a.name}（厅上）`);
    }
    notices.push(names.length ? `${names.join('、')}到了议事厅候令。` : '（宅里此刻没有当差的护院家丁。）');
  }

""" + anchor
if '叫护院家丁（当差的）' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('叫护院')
