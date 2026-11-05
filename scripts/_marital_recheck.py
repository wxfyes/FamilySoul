import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "  // 婚配：成年而缺字段的人，按世情补上（61 岁浆洗婆子不该是\"待字闺中\"）"
add = """  // 一次性：按新世情重算非亲眷的婚配（旧规则把 24 岁以上全判已婚，导致"全城皆已婚"）
  try {
    world.flags = world.flags || {};
    if (!world.flags.maritalRecheckV2) {
      let changed = 0;
      for (const a of Object.values(world.actors || {})) {
        if (!a || a.dead || a.id === 'husband') continue;
        const kin = a.household || a.spouse === 'husband' || a.spouse;
        const pregnant = a.pregnancy && !a.pregnancy.born;
        if (kin || pregnant) continue;
        if (!(Number(a.age) >= 18 && Number(a.age) <= 45)) continue;
        const next = inferMaritalStatus(a.name, a.role, a.age, a.gender);
        if (next !== a.marital) { a.marital = next; changed += 1; }
      }
      world.flags.maritalRecheckV2 = { day: world.clock?.day || 1, changed };
      if (changed) console.log(`[Persona] 按世情重判婚配 ${changed} 人`);
    }
  } catch { /* 忽略 */ }

""" + anchor
if anchor in s and 'maritalRecheckV2' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('一次性重判婚配')
