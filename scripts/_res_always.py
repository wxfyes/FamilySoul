import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function buildAllResidences' not in s:
    s = s.rstrip() + '''

/**
 * 巡检全世界的宅子：没院子的建院子，院子不够的补院子，再把下人安置好。
 * 每次读档都跑一遍（有院子的会立刻跳过，几乎不花钱），这样不会因为一次失败就永久缺院。
 */
export function buildAllResidences(world) {
  let homes = 0;
  let rooms = 0;
  let upgraded = 0;
  for (const [pid, p] of Object.entries(world?.places || {})) {
    if (!p) continue;
    const looksHome = p.residence || /宅|院|府/.test(String(p.name || '')) || /^house_/.test(pid);
    if (!looksHome) continue;
    if (!p.residence && /客栈|酒|茶|铺|坊|仓|衙|庙|观/.test(String(p.name || ''))) continue;

    const prop = (world.assets?.properties || []).find(
      (x) => x && (x.place === pid || (x.name && String(p.name || '').includes(String(x.name).split('（')[0]))),
    );
    const scale = prop && /七进/.test(String(prop.name || '')) ? 7 : prop && /大宅|五进/.test(String(prop.name || '')) ? 5 : 0;
    const before = p.rooms ? Object.keys(p.rooms).length : 0;
    const r = ensureResidence(world, pid, { scale, ownerId: prop?.owner || null });
    if (r.built) {
      homes += 1;
      rooms += r.rooms - before;
    }
    if (before && r.rooms > before) upgraded += 1;
    assignStaffQuarters(world, pid);
  }
  return { homes, rooms, upgraded };
}
'''
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加 buildAllResidences')

# state.js：两段一次性改成每次巡检
p2 = 'src/world/state.js'
t = io.open(p2, encoding='utf-8-sig').read()
start = t.find('  // 一次性：给所有宅子建出院子')
end = t.find('  // 一次性 v2：修悬空配偶')
if start < 0:
    start = t.find('  // 一次性 v2：修悬空配偶')
# 找到 v2 宅院升级段结束（下一个 // 一次性）
v2s = t.find('  // 一次性 v2：宅子按契纸规模升等')
if start > 0 and v2s > 0:
    v2e = t.find('  // 一次性', v2s + 10)
    block_end = v2e if v2e > 0 else len(t)
    new_block = """  // 每次读档巡检宅子：没院子的建、院子不够的补、下人按本分安置（失败下次还会再来）
  try {
    const r = buildAllResidences(world);
    if (r.homes || r.rooms) console.log(`[Residence] 建/补 ${r.homes} 座宅院，共 ${r.rooms} 间院子`);
  } catch (e) {
    console.warn('[Residence] 宅院巡检失败：', e.message);
  }

"""
    t = t[:start] + new_block + t[block_end:]
    t = t.replace("import { ensureResidence, assignStaffQuarters } from './residence.js';",
                  "import { buildAllResidences } from './residence.js';")
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('state 改为每次巡检')
