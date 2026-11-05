import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      if (a.marital) continue;"""
new = """      // 有孕在身，就不可能是"待字闺中"
      if (a.pregnancy && !a.pregnancy.born && (!a.marital || a.marital === 'single')) {
        a.marital = /丫鬟|通房|侍妾|妾/.test(String(a.role || '')) ? 'concubine' : 'married';
        fixed += 1;
        continue;
      }
      if (a.marital) continue;"""
if old in s and '有孕在身，就不可能是' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('迁移：有孕者不会是未婚')
