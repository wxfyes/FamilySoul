import io

p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()

# ---------- ① 知县起真名（姓 + 名），并按城名确定，稳定不跳 ----------
old = """      const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '周', '吴', '徐'];
      const sn = SURNAMES[Math.abs(cityName.length + cityName.charCodeAt(0)) % SURNAMES.length];
      world.actors = world.actors || {};
      world.actors[countyId] = {
        id: countyId, name: `${sn}知县`, role: `${cityName}知县`, gender: 'male',"""
new = """      const { name: countyName } = makeOfficialName(cityName);
      world.actors = world.actors || {};
      world.actors[countyId] = {
        id: countyId, name: countyName, role: `${cityName}知县`, gender: 'male',"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 知县改为真名生成')
else:
    print('WARN: 知县命名段没找到')

# ---------- ② 加入取名工具 + 旧存档自动改名 ----------
helper = """
/** 给官员起一个像人的名字：姓 + 名（按种子稳定生成，不会每轮变）*/
export function makeOfficialName(seed, fixedSurname = null) {
  const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '萧', '田', '董', '袁', '潘', '蔡', '蒋', '余', '杜'];
  const GIVEN = ['元芳', '守正', '文远', '子昂', '敬之', '国维', '怀安', '允升', '秉忠', '士诚', '廷玉', '孟春', '仲元', '季常', '景行', '德昭', '仁甫', '克明', '承宗', '明远', '守拙', '念祖', '敬修', '文正', '思远', '茂才', '志学', '允恭', '克勤', '清和'];
  const key = String(seed || '');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 131 + key.charCodeAt(i)) >>> 0;
  const sn = fixedSurname || SURNAMES[h % SURNAMES.length];
  const gv = GIVEN[(h >>> 7) % GIVEN.length];
  return { name: `${sn}${gv}`, surname: sn };
}
"""
anchor = "export function ensureCourt(world) {"
if anchor in s and 'makeOfficialName' not in s:
    s = s.replace(anchor, helper + "\n" + anchor, 1)
    print('② 加入 makeOfficialName')

# 旧存档：把「X知县」这类名字换成真名
mig = """export function migrateOwnership(world) {
  // 旧存档：知县名字是「李知县」这种占位，改成真名
  try {
    for (const a of Object.values(world.actors || {})) {
      if (!a || !a.name) continue;
      const m = String(a.name).match(/^([\\u4e00-\\u9fa5])知县$/);
      if (!m) continue;
      const { name } = makeOfficialName(String(a.id || a.role || ''), m[1]);
      a.name = name;
      console.log(`[State] 知县改名：${m[1]}知县 → ${name}`);
    }
  } catch { /* 忽略 */ }"""
anchor2 = "export function migrateOwnership(world) {"
if anchor2 in s and '知县改名' not in s:
    s = s.replace(anchor2, mig, 1)
    print('③ 加入旧存档改名迁移')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
