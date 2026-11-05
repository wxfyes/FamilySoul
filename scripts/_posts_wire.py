import io

# ① knock() 带上"门房是谁"：有人守门就由他回话，没人就无人应门
p = 'src/world/visit.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("const num = (v) => {", "import { gatekeeperOf } from './posts.js';\n\nconst num = (v) => {", 1)
old = """export function knock(world, visitorId, residenceId) {
  const home = world?.places?.[residenceId];
  if (!home || !home.residence) return { allowed: false, reason: '这不是私宅', place: null, owner: '', hall: null };
  const owner = String(home.owner || '');"""
new = """export function knock(world, visitorId, residenceId) {
  const home = world?.places?.[residenceId];
  if (!home || !home.residence) return { allowed: false, reason: '这不是私宅', place: null, owner: '', hall: null };
  const owner = String(home.owner || '');
  const keeper = gatekeeperOf(world, home.id);
  const keeperName = keeper?.name || '';
  const gateId = home.rooms?.gate?.id || null;
  const keeperAtGate = Boolean(keeper && gateId && keeper.location === gateId);"""
if old in s:
    s = s.replace(old, new, 1)
    # 各分支的措辞带上人
    s = s.replace("return { allowed: false, reason: '门房看你面生，又听说衙门在拿人，只肯留你在门外候着', place: null, owner, hall: null };",
                  "return { allowed: false, reason: `${keeperName || '门房'}看你面生，又听说衙门在拿人，只肯留你在门外候着`, place: null, owner, hall: null, keeper: keeperName };")
    s = s.replace("return { allowed: false, reason: '天黑了，门房说主人歇下了，请明早再来', place: null, owner, hall: null };",
                  "return { allowed: false, reason: keeperAtGate ? `${keeperName}说天黑了、主人已歇下，请你明早再来` : '夜里没人应门，里头都歇下了，请明早再来', place: null, owner, hall: null, keeper: keeperName };")
    s = s.replace("return { allowed: false, reason: '主人不在府里，门房不敢擅自放人进去', place: null, owner, hall: null };",
                  "return { allowed: false, reason: keeperAtGate ? `${keeperName}说主人不在府里，不敢擅自放人进去` : '门前无人，主人也不在府里', place: null, owner, hall: null, keeper: keeperName };")
    s = s.replace("""    return { allowed: false, reason: '门房进去回了一声，主人说与你不相熟，改日再会', place: null, owner, hall: hallId };""",
"""    return { allowed: false, reason: keeperAtGate ? `${keeperName}进去回了话，主人说与你不相熟，改日再会` : '主人说与你不相熟，改日再会', place: null, owner, hall: hallId, keeper: keeperName };""")
    s = s.replace("""  return { allowed: true, reason: kin ? '自家人，门房忙让进中堂' : '递了帖，主人说请进', place: hallId || home.id, owner, hall: hallId };""",
"""  return { allowed: true, reason: kin ? '自家人，门房忙让进中堂' : (keeperAtGate ? `${keeperName}递了帖，主人说请进` : '主人说请进'), place: hallId || home.id, owner, hall: hallId, keeper: keeperName };""")
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① knock 认门房')

# ② 门房按时辰上下值
p2 = 'src/world/room-life.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { materializeRoom } from './residence.js';",
              "import { materializeRoom } from './residence.js';\nimport { gatePostPlace } from './posts.js';", 1)
old2 = """  const slot = routine.filter((s) => num(s.at) <= num(hour)).pop() || routine[0];"""
new2 = """  // 门房当值：白天守大门，夜里回下房
  if (actor?.duty?.post === 'gate') {
    const postPlace = gatePostPlace(world, actor);
    if (postPlace) return postPlace;
  }
  const slot = routine.filter((s) => num(s.at) <= num(hour)).pop() || routine[0];"""
if old2 in t and '门房当值' not in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 门房按当值走动')
