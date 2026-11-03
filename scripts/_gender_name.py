import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "      if (MALE_ROLE.test(role) && !FEMALE_ROLE.test(role)) {"
new = """      // 名字里有 娘/婆/姑/嫂/妹/姐 的，一律女（如「锦娘」当掌柜）
      if (/[娘婆姑嫂妹姐氏]/.test(String(a.name || '')) && !/公|郎|爷|叔|伯|先生/.test(String(a.name || ''))) {
        if (a.gender !== 'female') { a.gender = 'female'; fixed += 1; }
        continue;
      }
      if (MALE_ROLE.test(role) && !FEMALE_ROLE.test(role)) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已加名字判性别')
