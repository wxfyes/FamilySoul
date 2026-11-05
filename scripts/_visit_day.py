import io
# ① 白天、主人在家：生客也放进门厅/中堂（内院仍要交情）；夜里一律不开
p = 'src/world/visit.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  const allowed = kin || trust >= 40;"""
new = """  // 白天且主人在家：生客也放进中堂（主人家自己看着办）；内院/卧房仍要交情
  const dayTime = hour >= 6 && hour < 21;
  const allowed = kin || trust >= 40 || (dayTime && ownerHere);"""
if old in s and 'dayTime' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 白天主人在家可进中堂')

# ② 玩家角色没写 role 的，给个"游侠"身份，别落成"客卿"
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """        const role = String(a.role || '').trim();
        if (!role) return m0;"""
new2 = """        const role = String(a.role || '').trim() || (a.humanBound ? '游侠' : '');"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 无角色玩家标游侠')
