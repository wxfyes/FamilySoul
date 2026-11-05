import io
p = 'src/world/heal.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      if (!a.marital && Number(a.age) >= 18 && a.id !== 'husband') {"""
new = """      // 名分纠正：通房/侍妾/姨娘一律是妾室，不能被当成"已婚"或"待字闺中"
      if (/通房|侍妾|小妾|姨娘/.test(String(a.role || '')) && a.marital !== 'concubine') {
        a.marital = 'concubine';
        fixes.push(`${a.name}名分校正为妾室`);
      }
      if (!a.marital && Number(a.age) >= 18 && a.id !== 'husband') {"""
if old in s and '名分校正为妾室' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('heal 纠正通房名分')
