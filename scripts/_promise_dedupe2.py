import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("  // 承诺去重")
end = s.find("export function migrateOwnership", start)
# 找到块尾：下一个 try 块结束
tail = s.find("  } catch { /* 忽略 */ }", start)
if start < 0 or tail < 0:
    print('WARN: 没找到去重块')
else:
    tail += len("  } catch { /* 忽略 */ }")
    block = '''  // 承诺去重：同一件事被天道记成好几条时，只留最完整的一条。
  // 判"同一件事"用文字相似度（同一天、两条内容六成重合就算同一件）。
  try {
    const norm = (t) => String(t || '').replace(/[，。、！？；：""''（）\\s]/g, '');
    const bigrams = (t) => {
      const out = new Set();
      for (let i = 0; i < t.length - 1; i += 1) out.add(t.slice(i, i + 2));
      return out;
    };
    const sim = (a, b) => {
      const A = bigrams(norm(a)); const B = bigrams(norm(b));
      if (!A.size || !B.size) return 0;
      let inter = 0;
      for (const x of A) if (B.has(x)) inter += 1;
      return inter / Math.min(A.size, B.size);
    };
    const list = (world.promises || []).filter(Boolean);
    const keep = [];
    for (const pr of list) {
      const dup = keep.find((k) => String(k.due ?? '') === String(pr.due ?? '') && sim(k.text, pr.text) >= 0.6);
      if (!dup) { keep.push(pr); continue; }
      if (String(pr.text || '').length > String(dup.text || '').length) {
        keep[keep.indexOf(dup)] = pr;
      }
    }
    if (keep.length !== list.length) {
      console.log(`[Promise] 合并重复：${list.length} → ${keep.length}`);
      world.promises = keep;
    }
  } catch { /* 忽略 */ }'''
    s = s[:start] + block + s[tail:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('已改为相似度去重')
