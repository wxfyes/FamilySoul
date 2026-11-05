import io

p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 顺序：地方经济（产灾、税、民心）必须先于国库结算
old_treasury = """  consumeSupplies(world);
  try {
    runTreasury(world, events);
  runMenses(world);
  runPersonalEconomy(world, events);
  runAllowances(world, events);
  } catch (err) {
    console.warn('[Treasury] 国库结算失败：', err.message);
  }"""
new_treasury = """  consumeSupplies(world);

  // 地方经济先跑：灾荒、税赋、民心都在这里生成，国库必须看得到当天的灾
  try {
    runLocalEconomy(world, events);
  } catch (err) {
    console.warn('[Econ] 地方经济结算失败：', err.message);
  }

  try {
    runTreasury(world, events);
  } catch (err) {
    console.warn('[Treasury] 国库结算失败：', err.message);
  }
  try {
    runMenses(world);
    runPersonalEconomy(world, events);
    runAllowances(world, events);
  } catch (err) {
    console.warn('[Treasury] 人口与月例结算失败：', err.message);
  }"""
if old_treasury in s:
    s = s.replace(old_treasury, new_treasury, 1)
    print('① 地方经济提到国库之前')

# ② 原处只留朝堂反应
old_local = """  try {
    runLocalEconomy(world, events);
    runCourtReaction(world, events, (o) => queueProactive(world, { type: 'court', ...o }));
  try {
    markCourtDecree(world);
  } catch (err) {
    console.warn('[Court] 朝议标记失败：', err.message);
  }
  } catch (err) {
    console.warn('[Econ] 地方经济结算失败：', err.message);
  }"""
new_local = """  try {
    runCourtReaction(world, events, (o) => queueProactive(world, { type: 'court', ...o }));
  } catch (err) {
    console.warn('[Court] 朝堂反应失败：', err.message);
  }
  try {
    markCourtDecree(world);
  } catch (err) {
    console.warn('[Court] 朝议标记失败：', err.message);
  }"""
if old_local in s:
    s = s.replace(old_local, new_local, 1)
    print('② 原处只留朝堂反应')

# ③ 灾荒概率：每城每天 4% → 0.01%（全国约 180 天一场，国祚约三年）
old_dis = "    if (Math.random() < 0.04) {"
new_dis = "    if (Math.random() < 0.0001) {   // 每城每天万分之一：全国约半年一灾"
if old_dis in s:
    s = s.replace(old_dis, new_dis, 1)
    print('③ 灾荒概率降到 0.01%')

# ④ 民心随税赋的斜率：税重才民变
old_unrest = "      ct.unrest = Math.max(0, Math.min(100, (Number(ct.unrest) || 0) + (tax >= 20 ? 1 : -1)));"
new_unrest = """      const unrestDelta = tax >= 30 ? 3 : tax >= 20 ? 2 : tax >= 15 ? 1 : -1;
      ct.unrest = Math.max(0, Math.min(100, (Number(ct.unrest) || 0) + unrestDelta));"""
if old_unrest in s:
    s = s.replace(old_unrest, new_unrest, 1)
    print('④ 民变斜率按税档')

io.open(p, 'w', encoding='utf-8-sig').write(s)
