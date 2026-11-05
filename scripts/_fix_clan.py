import io

# ============ ③ 宗族走动：只走血亲、姻亲与商帮 ============
p = 'src/world/clans.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """  const me = world.actors?.husband;
  const fame = num(me?.fame?.value);

  for (const clan of Object.values(world.clans)) {
    if (!clan) continue;
    // 名声好，宗族亲；名声坏，宗族远
    const drift = fame >= 30 ? 3 : fame <= -30 ? -4 : 1;
    clan.relation = Math.max(0, Math.min(100, num(clan.relation) + drift));

    if (clan.relation >= 60 && Math.random() < 0.5) {"""

new = """  const me = world.actors?.husband;
  const fame = num(me?.fame?.value);

  // 谁跟王家真有走动：本宗（同姓王）、姻亲（妻妾的姓）、商帮
  const related = new Set();
  const mySurname = String(me?.name || '').slice(0, 1);
  if (mySurname) related.add(`clan_${mySurname}`);
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    const isKin = a.household || a.spouse === 'husband' || a.relations?.husband?.trust !== undefined;
    if (!isKin) continue;
    const s2 = String(a.name || '').slice(0, 1);
    if (s2) related.add(`clan_${s2}`);
  }
  if (world.clans.bang) related.add('bang');

  for (const clan of Object.values(world.clans)) {
    if (!clan) continue;
    // 名声好，宗族亲；名声坏，宗族远（外姓宗族不因你名声而动）
    const isKin = related.has(clan.id);
    const drift = isKin ? (fame >= 30 ? 3 : fame <= -30 ? -4 : 1) : 0;
    clan.relation = Math.max(0, Math.min(100, num(clan.relation) + drift));

    // 只有本宗/姻亲/商帮才会登门；外姓宗族各自族内走动，不来王家
    if (!isKin) continue;
    if (clan.relation >= 60 && Math.random() < 0.5) {"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 宗族只走血亲姻亲与商帮')

# 姓氏不再写死 12 个：《百家姓》常见姓（覆盖绝大多数）
old_sur = """const SURNAMES = ['沈', '林', '王', '陆', '杨', '周', '吴', '陈', '刘', '赵', '钱', '孙'];"""
new_sur = """// 常见汉姓（不再写死 12 个，避免"李张"永远成不了族）
const SURNAMES = (
  '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜'
  + '戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐'
  + '费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄'
  + '和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁'
  + '杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍'
  + '虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚'
  + '程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓'
  + '牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙'
  + '叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻'
  + '莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温'
  + '别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡'
  + '国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾'
  + '毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公'
).split('');"""
if old_sur in s:
    s = s.replace(old_sur, new_sur, 1)
    print('② 姓氏表放开为百家姓')

io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ④ 名分：按"这个人的势力"算，不再写死王家 ============
p2 = 'src/world/reputation.js'
t = io.open(p2, encoding='utf-8-sig').read()
old_leg = """export function legitimacy(world, actorId) {
  const fame = fameOf(world, actorId);
  const cities = (world.factions?.wangjia?.cities || []).length;"""
new_leg = """export function legitimacy(world, actorId) {
  const fame = fameOf(world, actorId);
  // 找出以他为首的势力；没有势力就只按名声算
  const own = Object.values(world.factions || {}).find((f) => f && f.leader === actorId);
  const cities = own ? (own.cities || []).length : 0;"""
if old_leg in t:
    t = t.replace(old_leg, new_leg, 1)
    print('③ 名分不再写死王家')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
