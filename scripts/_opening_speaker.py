import io
# ① 开场提示：必须有人在场开口；需要人就用 [[spawn:名|身份]] 让引擎真立起来
p = 'src/world/opening.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    '2. 必须用在场的人开口（若没有人，就写他进门看到的第一眼，外加门外的人声/街上的动静）。',"
new = """    '2. 必须让一个人开口：他身边若没有人，就安排一个合理的过门人（邻居、货郎、房东、路过的差役）。',
    '   这个人要用 [[spawn:姓名|身份]] 声明，引擎会真的把他立进世界，以后还能再见。',
    '3. 台词前必须写说话人：【姓名】：……（旁白不要标人名）。',"""
if old in s:
    s = s.replace(old, new, 1)
    s = s.replace("    '3. 台词要有身份口吻，不要现代词，不要说\"欢迎来到这个世界\"。',", "    '4. 台词要有身份口吻，不要现代词，不要说\"欢迎来到这个世界\"。',")
    s = s.replace("    '4. 结尾留一个自然的开口", "    '5. 结尾留一个自然的开口")
    s = s.replace("    '5. 字数 120~220 字。',", "    '6. 字数 120~220 字。',")
    print('① 开场提示改为"必须有人开口+spawn"')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ② server：解析 spawn 与说话人
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """      a.opened = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
      saveState(DATA_DIR, world);"""
new2 = """      // 开场里的人：天道声明了就用引擎真立起来，并放到他身边
      let spawnedName = '';
      try {
        const spawnTags = String(text).match(/\\[\\[spawn:([^\\]]+)\\]\\]/g);
        if (spawnTags) {
          for (const tag of spawnTags) {
            const mm = /\\[\\[spawn:([^|\\]]+)(?:\\|([^\\]]+))?\\]\\]/.exec(tag);
            if (!mm) continue;
            const whoName = String(mm[1]).trim().slice(0, 4);
            const whoRole = String(mm[2] || '街坊').trim().slice(0, 10);
            if (!/^[\\u4e00-\\u9fa5]{2,4}$/.test(whoName)) continue;
            if (Object.values(world.actors || {}).some((x) => x && x.name === whoName)) { spawnedName = whoName; continue; }
            const nid = `npc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            world.actors[nid] = {
              id: nid, name: whoName, role: whoRole, gender: 'unknown',
              home: a.location, location: a.location, money: 0, relations: {}, schedule: [],
              origin: 'dm_opening', createdDay: world.clock?.day || 1,
            };
            spawnedName = whoName;
            console.log(`[Opening] 天道立了个过门人：${whoName}（${whoRole}）`);
          }
        }
      } catch { /* 忽略 */ }

      a.opened = { day: world.clock?.day || 1, hour: world.clock?.hour || 0 };
      saveState(DATA_DIR, world);"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('② 解析并立起过门人')

# 去掉正文里的 spawn 标记 + 提取说话人
old3 = """        console.log(`[Opening] ${a.name} 落地第一幕已生成（${text.length} 字）`);
        return sendJson(res, 200, { ok: true, text });"""
new3 = """        const cleaned = text.replace(/\\[\\[spawn:[^\\]]+\\]\\]/g, '').trim();
        const speakerMatch = cleaned.match(/【([^】]{1,8})】：/);
        const speaker = speakerMatch ? speakerMatch[1] : (spawnedName || '旁白');
        console.log(`[Opening] ${a.name} 落地第一幕已生成（${cleaned.length} 字，说话人=${speaker}）`);
        return sendJson(res, 200, { ok: true, text: cleaned, speaker, spawned: spawnedName || '' });"""
if old3 in t:
    t = t.replace(old3, new3, 1)
    print('③ 返回说话人')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
