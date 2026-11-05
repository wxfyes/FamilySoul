import io

# ============ 修 ② 真实地理邻接表（废弃 i±1） ============
p = 'src/world/geography.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """/** 相邻的道：按 geo.regions 的顺序首尾相连（地理上相邻，简化但稳定） */
export function neighborRegions(world, region) {
  const list = (world.geo?.regions || []).map((r) => r.name);
  const i = list.indexOf(region);
  if (i < 0) return [];
  const out = [];
  if (i > 0) out.push(list[i - 1]);
  if (i < list.length - 1) out.push(list[i + 1]);
  return out;
}"""

new = """/**
 * 各道真实接壤表（古代驿道/山河阻隔的近似）。
 * 双向自动补齐：A 写 B，B 也自动算作邻 A。
 */
export const REGION_ADJACENCY = {
  江南道: ['淮南道', '淮北道', '闽浙道', '江西道', '荆湖道'],
  京畿道: ['河南道', '河北道', '山东道', '淮南道', '关内道'],
  淮南道: ['江南道', '淮北道', '河南道', '京畿道'],
  河北道: ['京畿道', '山东道', '河东道', '辽东道', '关内道'],
  岭南道: ['闽浙道', '江西道', '荆湖道', '云贵道'],
  剑南道: ['陇右道', '云贵道', '荆湖道', '关内道'],
  山东道: ['京畿道', '河北道', '河南道', '淮北道', '辽东道'],
  河东道: ['河北道', '关内道', '河南道', '京畿道'],
  关内道: ['京畿道', '河北道', '河东道', '陇右道', '剑南道'],
  荆湖道: ['江南道', '江西道', '河南道', '剑南道', '云贵道', '岭南道'],
  河南道: ['京畿道', '山东道', '淮南道', '淮北道', '荆湖道', '河东道'],
  辽东道: ['河北道', '山东道'],
  陇右道: ['关内道', '剑南道'],
  云贵道: ['剑南道', '荆湖道', '岭南道'],
  闽浙道: ['江南道', '江西道', '岭南道'],
  江西道: ['江南道', '闽浙道', '荆湖道', '岭南道'],
  淮北道: ['淮南道', '河南道', '山东道', '江南道'],
};

/** 相邻的道：查表，并且双向承认 */
export function neighborRegions(world, region) {
  const name = String(region || '');
  if (!name) return [];
  const out = new Set(REGION_ADJACENCY[name] || []);
  for (const [r, list] of Object.entries(REGION_ADJACENCY)) {
    if (list.includes(name)) out.add(r);
  }
  return [...out];
}"""

if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 真实地理邻接表')
else:
    print('WARN: 未找到旧邻接函数')
