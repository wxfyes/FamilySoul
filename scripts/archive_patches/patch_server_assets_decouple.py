with open('src/server.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

# 1. 修复 /api/me 产业过滤
old_me_props = "      const props = (world.assets?.properties || []).filter((p) => (isHusband ? true : p.keeper === actorId));"
new_me_props = """      // 产业归属解耦：相公看相公产业，女眷看女眷私产
      const props = (world.assets?.properties || []).filter((p) => {
        if (!p) return false;
        if (isHusband) {
          return p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper);
        }
        return p.keeper === actorId || p.owner === actorId;
      });"""

assert old_me_props in text, "old_me_props not found in server.js"
text = text.replace(old_me_props, new_me_props, 1)

# 2. 修复 digest 相公日入统计
old_digest = """        const silverVal = Number(world.assets?.silver || 0).toFixed(1);
        const propList = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
        const dailyInc = propList.reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0).toFixed(1);"""

new_digest = """        const silverVal = Number(world.assets?.silver || 0).toFixed(1);
        const allProps = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
        const propList = allProps.filter((p) => p && (p.owner === 'husband' || p.keeper === 'husband' || (!p.owner && !p.keeper)));
        const dailyInc = propList.reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0).toFixed(1);"""

assert old_digest in text, "old_digest not found in server.js"
text = text.replace(old_digest, new_digest, 1)

with open('src/server.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("server.js props decoupling patched successfully!")

