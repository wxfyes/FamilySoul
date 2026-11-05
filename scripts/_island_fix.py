import io

# ============ ① places-target：王宅别名一律回丈夫正房/大门 ============
p = 'src/world/places-target.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """export function resolvePlaceTarget(world, hint, { nearId = '', actor = null } = {}) {
  const places = placeList(world);
  if (!places.length) return null;
  const text = String(hint || '');"""
new = """export function resolvePlaceTarget(world, hint, { nearId = '', actor = null } = {}) {
  const places = placeList(world);
  if (!places.length) return null;
  const text = String(hint || '');

  // 王宅（含七进大宅院/王家大宅这种产业名）一律回丈夫正房或大门，绝不另辟孤岛
  if (/王宅|王家大宅|七进大宅|王家庭院/.test(text)) {
    const gate = 'husband_room__gate';
    const main = 'husband_room';
    if (world.places?.[gate]) return gate;
    if (world.places?.[main]) return main;
  }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 王宅别名归位')

# ============ ② apply.js：不再随意劈建孤岛 ============
p2 = 'src/world/apply.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """        if (found) {
          finalTargetId = found[0];
        } else {
          world.flags = world.flags || {};
          world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
          finalTargetId = `place_${world.flags.placeSeq}`;"""
new2 = """        if (found) {
          finalTargetId = found[0];
        } else {
          // 先按"去哪儿"的规则翻译一次（王宅→正房/大门、后院→后院花园…），能落回真实地点就不造新景
          let mapped = null;
          try {
            mapped = resolvePlaceTarget(world, targetPlaceName, { nearId: actor.location, actor });
          } catch { /* 忽略 */ }
          const looksRealPlace = /宅|院|府|楼|铺|店|栈|坊|仓|衙|寺|观|庙|街|巷|桥|渡|场|坊/.test(String(targetPlaceName));
          if (mapped && world.places?.[mapped]) {
            finalTargetId = mapped;
            console.log(`[Apply:${intent.id}] 目标「${targetPlaceName}」归位到「${world.places[mapped].name}」`);
          } else if (!looksRealPlace) {
            // 不像地名：不造景，原地不动，交给天道用台词处理
            console.log(`[Apply:${intent.id}] 目标「${targetPlaceName}」不是地名，不辟新景`);
            break;
          } else {
          world.flags = world.flags || {};
          world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
          finalTargetId = `place_${world.flags.placeSeq}`;"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    # 补齐多出来的括号：原来 else 块的结尾是 "}" 前有 "}"
    old3 = """          console.log(`[Apply:${intent.id}] 天道造景入册: 成功辟建【${targetPlaceName}】(id=${finalTargetId})`);
          stateChanged = true;
        }
      }"""
    new3 = """          console.log(`[Apply:${intent.id}] 天道造景入册: 成功辟建【${targetPlaceName}】(id=${finalTargetId})`);
          stateChanged = true;
          }
        }
      }"""
    if old3 in t:
        t = t.replace(old3, new3, 1)
    # 引入解析器
    if 'places-target.js' not in t:
        t = t.replace("import { getPlaceDisplayName } from './naming.js';",
                      "import { getPlaceDisplayName } from './naming.js';\nimport { resolvePlaceTarget } from './places-target.js';")
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② apply 不再乱造孤岛')
