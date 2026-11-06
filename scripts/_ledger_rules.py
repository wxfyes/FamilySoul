import io
# ① 银钱账：统一带 category，拒绝垃圾标题
p = 'src/world/ledger.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("const MAX = 300;", "import { moneyCategory, JUNK_PLACE } from './ledger-rules.js';\n\nconst MAX = 300;", 1)
old = """export function appendLedger(world, { delta = 0, title = '', by = 'husband' } = {}) {
  const amount = Math.round(Number(delta) * 100) / 100;
  if (!amount) return null;
  world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
  const entry = {
    day: world.clock?.day || 1,
    hour: world.clock?.hour || 0,
    delta: amount,
    title: String(title || (amount > 0 ? '进账' : '花销')).slice(0, 24),
    by,
    balance: Math.round((Number(world.assets?.silver) || 0) * 100) / 100,
  };"""
new = """export function appendLedger(world, { delta = 0, title = '', by = 'husband' } = {}) {
  const amount = Math.round(Number(delta) * 100) / 100;
  if (!amount) return null;
  // 入账资格：标题不能是"付3两"这类话，且必须能归入白名单类别
  let cleanTitle = String(title || (amount > 0 ? '进账' : '花销')).slice(0, 24);
  if (JUNK_PLACE.test(cleanTitle)) cleanTitle = amount > 0 ? '进账' : '开销';
  world.ledger = Array.isArray(world.ledger) ? world.ledger : [];
  const entry = {
    day: world.clock?.day || 1,
    hour: world.clock?.hour || 0,
    delta: amount,
    title: cleanTitle,
    category: moneyCategory(cleanTitle, amount),
    by,
    balance: Math.round((Number(world.assets?.silver) || 0) * 100) / 100,
  };"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 流水带类别')

# ② 地点账：建新地点前验名
p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { ensureCityBase, streetOfCity, cityOfPlace } from './world/city.js';",
              "import { ensureCityBase, streetOfCity, cityOfPlace } from './world/city.js';\nimport { isPlaceNameOk } from './world/ledger-rules.js';", 1)
old2 = """        const placeName = String(body.place || '').trim().slice(0, 20);"""
new2 = """        const placeName = String(body.place || '').trim().slice(0, 20);
        if (!isPlaceNameOk(placeName)) return sendJson(res, 400, { ok: false, error: '这不像个地名' });"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 地点名准入')

# ③ 产业：统一用 isBusinessName
p3 = 'src/world/dispatch.js'
u = io.open(p3, encoding='utf-8-sig').read()
u = u.replace("import { appendLedger } from './ledger.js';", "import { appendLedger } from './ledger.js';\nimport { isBusinessName } from './ledger-rules.js';", 1)
old3 = """        // 客房/上房不是产业：睡觉的地方不该进"名下产业"账
        if (/上房|客房|房间|厢房|卧房|雅间/.test(name)) {
          applied.push(`忽略产业：「${name}」是客房不是铺子`);
          continue;
        }
        if (badName || !shopSuffix || name.length < 2 || name.length > 12) {"""
new3 = """        // 入账资格：产业名必须是铺号（客房、量词、账单一律不收）
        if (!isBusinessName(name)) {
          applied.push(`忽略产业：「${name}」不像铺号`);
          console.log(`[Property] 拒绝造产业：${name}（不像铺号）`);
          continue;
        }
        if (badName || !shopSuffix || name.length < 2 || name.length > 12) {"""
if old3 in u:
    u = u.replace(old3, new3, 1)
    io.open(p3, 'w', encoding='utf-8-sig').write(u)
    print('③ 产业名准入')
