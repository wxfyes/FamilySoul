import io
p = 'src/world/dwelling.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① "自己家"必须真是自己的：不能拿别人私宅当 home
old = """  // 自己家
  const home = world?.places?.[actor.home];
  if (home && home.id === placeId) return true;
  return false;"""
new = """  // 自己家：必须这宅子本来就是他的（无主或主人是他），不能靠 home 字段自证
  const home = world?.places?.[actor.home];
  if (home && home.id === placeId && (!home.owner || home.owner === actor.id)) return true;
  return false;"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 自己家判定收紧')

# ② 门牌号不许撞车
old2 = """  world.flags.dwellingSeq = num(world.flags.dwellingSeq) + 1;
  const pid = `house_${world.flags.dwellingSeq}`;"""
new2 = """  let pid = '';
  do {
    world.flags.dwellingSeq = num(world.flags.dwellingSeq) + 1;
    pid = `house_${world.flags.dwellingSeq}`;
  } while (world.places[pid]);"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 门牌号去重')
io.open(p, 'w', encoding='utf-8-sig').write(s)
