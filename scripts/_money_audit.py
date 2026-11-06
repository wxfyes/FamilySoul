import io
# ① 台词说付了钱、引擎没入账 → 明确提示（不是替玩家付，是把事实摆出来）
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      // 主模型没写回执 → 记账员在后台补记（不阻塞回复，否则容易拖到客户端超时）"""
new = """      // 台词里说了"付了/给了/赏了 X 两"，但这一轮引擎没收到任何回执：把事实摆出来
      try {
        const payTalk = /(付了|给了|赏了|交了|打点了)[^。！？\\n]{0,10}?([0-9一二三四五六七八九十百]+)\\s*两/.exec(String(say || ''));
        if (payTalk && applied.length === 0) {
          reply += `\\n（这桩 ${payTalk[2]} 两的花费还没入账：要真付，说一声"记一笔"。）`;
          console.log(`[Money] 台词提到花销但无回执：${payTalk[0]}`);
        }
      } catch { /* 忽略 */ }

      // 主模型没写回执 → 记账员在后台补记（不阻塞回复，否则容易拖到客户端超时）"""
if old in s and '花费还没入账' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 未入账提示')

# ② 每日对账：银子变动 vs 流水合计
p2 = 'src/world/ledger.js'
t = io.open(p2, encoding='utf-8-sig').read()
if 'export function reconcileMoney' not in t:
    t += '''

/**
 * 每日对账：昨日开盘银子 + 当日流水合计 = 今日子弹？不对就是账有问题
 * @returns {{ok:boolean, diff:number, expected:number, actual:number}}
 */
export function reconcileMoney(world, day) {
  const open = Number(world?.flags?.dayOpenSilver);
  if (!Number.isFinite(open)) return { ok: true, diff: 0, expected: 0, actual: 0 };
  const actual = Math.round((Number(world?.assets?.silver) || 0) * 100) / 100;
  const sum = (Array.isArray(world?.ledger) ? world.ledger : [])
    .filter((e) => e && Number(e.day) === Number(day))
    .reduce((s, e) => s + (Number(e.delta) || 0), 0);
  const expected = Math.round((open + sum) * 100) / 100;
  const diff = Math.round((actual - expected) * 100) / 100;
  const ok = Math.abs(diff) <= 0.05;
  if (!ok) {
    world.flags = world.flags || {};
    world.flags.moneyAudit = { day: Number(day), open, sum: Math.round(sum * 100) / 100, expected, actual, diff, at: Date.now() };
    console.warn(`[Money] 账不平：第${day}日 期初${open} + 流水${Math.round(sum * 100) / 100} = ${expected}，实际 ${actual}，差 ${diff}`);
  }
  world.flags.dayOpenSilver = actual;
  return { ok, diff, expected, actual };
}
'''
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 对账函数')
