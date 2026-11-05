import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          if (isHumanBound(wPres, who.id) && !kin2) {"""
new = """          const isRealUser = /^usr_/.test(String(who.id)) || isHumanBound(wPres, who.id);
          if (isRealUser && !kin2) {"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 真人号判定扩展到 usr_ 前缀')
