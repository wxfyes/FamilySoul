import io

# ============ ① 三条雇人通道都记"东家" ============
# 1) 天道 [[staff:...]]
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
          if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
          prop.staff = prop.staffIds.length;
          if (prop.placeId && wS.places?.[prop.placeId]) {"""
new = """          prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
          if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
          prop.staff = prop.staffIds.length;
          // 记明东家：他知道自己在替谁做事
          a.employer = prop.owner || 'husband';
          a.workplace = prop.name;
          a.workplaceId = prop.placeId || null;
          if (!a.home && prop.placeId) a.home = prop.placeId;
          if (prop.placeId && wS.places?.[prop.placeId]) {"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 天道雇人记东家')

# ② 用人事实注入：让天道知道谁替谁做事
old2 = "    // 在场者的习性：同一句话，不同性子的人反应不一样"
new2 = """    // 用人事实：谁在相公哪家店做事（免得雇工装作不认识东家）
    try {
      const wEmp = loadState(this.dataDir);
      const lines = Object.values(wEmp.actors || {})
        .filter((a) => a && !a.dead && a.employer === 'husband' && a.workplace)
        .slice(0, 12)
        .map((a) => `${a.name}是相公${a.workplace}的${a.role || '伙计'}`);
      if (lines.length) contextHintEarly += `（【用人】${lines.join('；')}。这些人都认相公是东家，说话要带这层本分。）\\n`;
    } catch { /* 忽略 */ }

    // 在场者的习性：同一句话，不同性子的人反应不一样"""
if old2 in s and '【用人】' not in s:
    s = s.replace(old2, new2, 1)
    print('② 注入用人事实')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# 3) 自检修账雇人 / 管理接口雇人
p2 = 'src/world/audit.js'
t = io.open(p2, encoding='utf-8-sig').read()
old3 = """        prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
        if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
        prop.staff = prop.staffIds.length;
        fixed += 1;"""
new3 = """        prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
        if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
        prop.staff = prop.staffIds.length;
        a.employer = prop.owner || 'husband';
        a.workplace = prop.name;
        a.workplaceId = prop.placeId || null;
        fixed += 1;"""
if old3 in t:
    t = t.replace(old3, new3, 1)
    print('③ 自检雇人记东家')
io.open(p2, 'w', encoding='utf-8-sig').write(t)

p3 = 'src/server.js'
u = io.open(p3, encoding='utf-8-sig').read()
old4 = """        prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
        if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
        prop.staff = prop.staffIds.length;
        saveState(DATA_DIR, world);"""
new4 = """        prop.staffIds = Array.isArray(prop.staffIds) ? prop.staffIds : [];
        if (!prop.staffIds.includes(a.id)) prop.staffIds.push(a.id);
        prop.staff = prop.staffIds.length;
        a.employer = prop.owner || 'husband';
        a.workplace = prop.name;
        a.workplaceId = prop.placeId || null;
        saveState(DATA_DIR, world);"""
if old4 in u:
    u = u.replace(old4, new4, 1)
    print('④ 管理接口雇人记东家')
io.open(p3, 'w', encoding='utf-8-sig').write(u)
print('done')
