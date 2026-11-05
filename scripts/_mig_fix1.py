import io

# ============ ① 婚配走单一推导；② 撞名顺位补字，不许卡死 ============
p = 'src/world/migration.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'persona.js' not in s:
    s = s.replace("const num = (v) => {", "import { inferMaritalStatus } from './persona.js';\n\nconst num = (v) => {", 1)
    print('① 引入婚配推导')

# 撞名：顺位补字（郎/娘/氏/哥/姐…），再不行才兜底名
old_name = """  const nm = String(name || '').trim() || fallbackName(world, pm.gender);
  if (!nm) return null;
  if (Object.values(world.actors || {}).some((a) => a && a.name === nm)) return null;"""
new_name = """  const gender = pm.gender === 'female' ? 'female' : 'male';
  const taken = (n) => Object.values(world.actors || {}).some((a) => a && a.name === n);

  // 名字冲突不许卡死：顺位补字（李四 → 李四郎 / 李四娘 / 李四氏 / 李四哥）
  const suffixes = gender === 'female' ? ['娘', '氏', '姐', '姑'] : ['郎', '哥', '生', '二'];
  let nm = String(name || '').trim();
  if (!nm || taken(nm)) {
    const base = nm || fallbackName(world, gender) || '';
    nm = base;
    if (!nm || taken(nm)) {
      for (const suf of suffixes) {
        const cand = `${base}${suf}`;
        if (!taken(cand)) { nm = cand; break; }
      }
    }
    if (!nm || taken(nm)) {
      for (let i = 0; i < 10; i += 1) {
        const cand = fallbackName(world, gender);
        if (cand && !taken(cand)) { nm = cand; break; }
      }
    }
  }
  if (!nm || taken(nm)) return null;   // 真的取不出名字才放弃（下轮会再试）"""
if old_name in s:
    s = s.replace(old_name, new_name, 1)
    print('② 撞名顺位补字')

# 婚配：不许手写 single，一律按世情推
old_marital = """    marital: pm.cause === 'bride' ? 'married' : 'single',"""
new_marital = """    marital: inferMaritalStatus(nm, pm.role, Number(age) || Number(pm.age) || 25, gender),"""
if old_marital in s:
    s = s.replace(old_marital, new_marital, 1)
    print('③ 婚配按世情推（禁止手写 single）')

io.open(p, 'w', encoding='utf-8-sig').write(s)
