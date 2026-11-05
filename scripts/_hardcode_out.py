import io

# ============ ① 提示词：让天道用 [[depart:谁|去哪]] 声明离场 ============
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    lines.push('- 【物理派人传话真实法则】"
add = """    lines.push('- 【离场要写标签】：真有人起身走了（回房、出府、去码头、去酒楼、告辞），在末尾写 [[depart:谁|去哪儿]]；引擎会真的把他挪过去，并从在场名单里划掉。只是嘴上说"这就去"不算走，别乱写。');
"""
if '[[depart:' not in s:
    if anchor in s:
        s = s.replace(anchor, add + anchor, 1)
        print('① 提示词加离场标签')

# ② 女眷判定改为按数据（household / spouse），不再按名字
old2 = """      const isHouseholdWife = /婉儿|芸娘|柳儿/.test(cleanAsName || '');"""
new2 = """      const speakerActor = wSnap?.actors ? Object.values(wSnap.actors).find((x) => x && x.name === cleanAsName) : null;
      const isHouseholdWife = Boolean(speakerActor && (speakerActor.household || speakerActor.spouse === 'husband'));"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 女眷按数据判定')

# ③ 英文 ID 兜底：能查到就用查到的人，查不到就用身份，不再写死"何顺"
old3 = """        cleanAsName = aObj?.name || (cleanAsName === 'heshun' ? '何顺' : '伙计');"""
new3 = """        cleanAsName = aObj?.name || (aObj?.role ? String(aObj.role).slice(0, 4) : '店里的伙计');"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 英文 ID 不再写死')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ④ clock 的 safeSpeaker 同样去硬编码
p2 = 'src/world/clock.js'
t = io.open(p2, encoding='utf-8-sig').read()
old4 = """(world.actors?.[ap.name]?.name || (ap.name === 'heshun' ? '何顺' : String("""
new4 = """(world.actors?.[ap.name]?.name || String("""
if old4 in t:
    t = t.replace(old4, new4, 1)
    print('④ clock 去硬编码')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
