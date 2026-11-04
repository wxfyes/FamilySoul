import io
# ① 注册：直接住自己院子，不再"投宿客栈"
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("      location: 'inn',\n      marital: 'single',", "      location: houseId,\n      marital: 'single',")
s = s.replace("初到临江府，暂投宿于临江客栈大堂。", "初到临江府，落脚在自家小院。")
s = s.replace("（${genderDesc}，春秋${numAge}，${roleName}），初到临江府，暂投宿于临江客栈大堂。", "（${genderDesc}，春秋${numAge}，${roleName}），初到临江府，落脚在自家小院。")
# 事件描述里的"落脚客栈"也改
s = s.replace("初涉江湖，落脚客栈。", "初涉江湖，落脚自家小院。")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('① 注册直接住小院')

# ② 迁移：老注册号从客栈搬回自己院子；顺手修掉"投宿客栈"的旧记忆
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
old = """        a.residence = { type: 'own', placeId: houseId };
        if (!a.home || a.home === 'inn') a.home = houseId;"""
new = """        a.residence = { type: 'own', placeId: houseId };
        if (!a.home || a.home === 'inn') a.home = houseId;
        if (a.location === 'inn') a.location = houseId;   // 有院子就别再"投宿客栈\""""
if old in t and '有院子就别再' not in t:
    t = t.replace(old, new, 1)
    print('② 迁移把人搬回小院')

# 修旧记忆措辞
old2 = """      if (!a.marital) a.marital = 'single';"""
new2 = """      // 旧记忆里"暂投宿于临江客栈"与"有自家小院"矛盾，统一改掉
      for (const m of world.memories || []) {
        if (m && String(m.text || '').includes(a.name) && String(m.text).includes('投宿于临江客栈')) {
          m.text = String(m.text).replace('暂投宿于临江客栈大堂', '落脚在自家小院').replace('投宿于临江客栈大堂', '落脚在自家小院');
        }
      }
      if (!a.marital) a.marital = 'single';"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('③ 修旧记忆措辞')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
