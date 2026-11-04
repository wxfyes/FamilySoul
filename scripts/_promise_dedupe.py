import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "export function migrateOwnership(world) {"
add = """export function migrateOwnership(world) {
  // 承诺去重：同一个人、同一件事、同一天之内，只留最新一条
  // （天道常把一句话记成好几条，攒久了列表会炸）
  try {
    const keyOf = (p) => {
      const who = String(p?.actorId || p?.name || '');
      const day = String(p?.due ?? p?.dueDay ?? '');
      const body = String(p?.text || '').replace(/[，。、！？\\s“”"'']/g, '').slice(0, 10);
      return `${who}|${day}|${body}`;
    };
    const seen = new Map();
    const kept = [];
    for (const pr of world.promises || []) {
      if (!pr) continue;
      const k = keyOf(pr);
      if (seen.has(k)) {
        const prev = seen.get(k);
        // 留文本更完整的那条
        if (String(pr.text || '').length > String(prev.text || '').length) {
          kept[kept.indexOf(prev)] = pr;
          seen.set(k, pr);
        }
        continue;
      }
      seen.set(k, pr);
      kept.push(pr);
    }
    if (kept.length !== (world.promises || []).length) {
      console.log(`[Promise] 去重：${(world.promises || []).length} → ${kept.length}`);
      world.promises = kept;
    }
  } catch { /* 忽略 */ }"""
if anchor in s and '承诺去重' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('已加承诺去重规则')
