import io
p = 'src/world/residence.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'export function repairRooms' not in s:
    s = s.replace("/**\n * 宅门与各院互通（幂等）", """/**
 * 修院：账上记着某个院子，但世界里那个地点没了（或被清过）→ 补回来并连门路。
 */
export function repairRooms(world, rootId) {
  const root = world?.places?.[rootId];
  if (!root?.rooms) return 0;
  root.exits = Array.isArray(root.exits) ? root.exits : [];
  let fixed = 0;
  for (const [key, r] of Object.entries(root.rooms)) {
    if (!r || !r.id) continue;
    if (!world.places[r.id]) {
      world.places[r.id] = {
        id: r.id, name: `${String(root.name || '宅').split('·').slice(0, 2).join('·')}·${r.name}`,
        residence: true, use: r.use, parent: rootId, owner: root.owner || null,
        exits: [rootId], dynamic: true,
      };
      fixed += 1;
    }
    if (!root.exits.includes(r.id)) root.exits.push(r.id);
  }
  return fixed;
}

/**
 * 宅门与各院互通（幂等）""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加 repairRooms')

p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
t = t.replace("import { ensureResidence } from './world/residence.js';",
              "import { ensureResidence, repairRooms } from './world/residence.js';")
t = t.replace("""            const r = ensureResidence(world, myHomeId);
            if (r.built) { ensureMarket(world); saveState(DATA_DIR, world); }""",
"""            const r = ensureResidence(world, myHomeId);
            const fixed = repairRooms(world, myHomeId);
            if (r.built || fixed) { saveState(DATA_DIR, world); }""")
io.open(p2, 'w', encoding='utf-8-sig').write(t)
print('菜单路径补修院')
