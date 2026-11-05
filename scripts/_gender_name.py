import io
# 性别：明显的男子名不能被当成女子（张彪、王虎、李刚…）
p = 'src/world/persona.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  if (/[公郎爷叔伯先生]*/.test('') && /先生|郎君|公子|老爷|少爷|和尚|道士|僧|侠|镖师|捕快/.test(text)) return 'male';
  return fallback;"""
new = """  if (/先生|郎君|公子|老爷|少爷|和尚|道士|僧|侠|镖师|捕快|教头|武师/.test(text)) return 'male';
  // 名字里带这些字，基本是男子
  if (/彪|虎|龙|刚|强|勇|铁|钢|山|川|军|武|雄|豪|霸|峰|磊|鹏|虎|豹|骏|驹|锤|刀|箭/.test(String(name || ''))) return 'male';
  return fallback;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 男子名识别')

# heal：女名却带男子字 → 纠正
p2 = 'src/world/heal.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """      // 性别不许留 unknown：看不出女子特征就当男子
      if (!a.gender || a.gender === 'unknown') {"""
new2 = """      // 明显男子名却被当成女子 → 纠正
      if (a.gender === 'female' && /彪|虎|龙|刚|强|勇|铁|钢|军|武|雄|豪|霸|峰|磊|鹏|豹|骏|驹/.test(String(a.name || ''))) {
        a.gender = 'male';
        fixes.push(`${a.name}性别校正为男（名字是男子名）`);
      }
      // 性别不许留 unknown：看不出女子特征就当男子
      if (!a.gender || a.gender === 'unknown') {"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② heal 纠正男子名')

# 播种目标提到 14，每月维持 18
p3 = 'src/world/demography.js'
u = io.open(p3, encoding='utf-8-sig').read()
u = u.replace("export function seedUnmarriedPool(world, target = 12) {", "export function seedUnmarriedPool(world, target = 14) {")
io.open(p3, 'w', encoding='utf-8-sig').write(u)
print('③ 播种目标 14')
