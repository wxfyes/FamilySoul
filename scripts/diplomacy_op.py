import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      } else if (kind === 'march') {"
inject = (
    "      } else if (kind === 'diplomacy') {\n"
    "        // 对邻国表态：纳贡/通商/拒使/和亲\n"
    "        const who = String(args.to || args.country || args.who || '').trim();\n"
    "        const act = String(args.action || args.act || '').trim();\n"
    "        const list = Object.values(world.foreign || {});\n"
    "        const n = list.find((x) => x && (x.id === who || x.name === who || String(x.name).includes(who)));\n"
    "        if (!n || !act) continue;\n"
    "        const rel = Number(n.relation) || 50;\n"
    "        if (act === 'pay' || act === 'tribute') {\n"
    "          const cost = Math.max(10, Math.round((Number(n.army) || 100) * 0.02));\n"
    "          if ((Number(world.assets.silver) || 0) < cost) { applied.push(`纳贡失败:需${cost}两`); continue; }\n"
    "          world.assets.silver = round2((Number(world.assets.silver) || 0) - cost);\n"
    "          n.relation = Math.min(100, rel + 15);\n"
    "          applied.push(`纳贡${cost}两→${n.name}，关系+15`);\n"
    "        } else if (act === 'trade') {\n"
    "          n.relation = Math.min(100, rel + 8);\n"
    "          world.flags = world.flags || {};\n"
    "          world.flags.tradeBonus = (Number(world.flags.tradeBonus) || 0) + 0.02;\n"
    "          applied.push(`与${n.name}通商，关系+8`);\n"
    "        } else if (act === 'refuse') {\n"
    "          n.relation = Math.max(0, rel - 12);\n"
    "          applied.push(`拒${n.name}使，关系-12`);\n"
    "        } else if (act === 'marry') {\n"
    "          n.relation = Math.min(100, rel + 20);\n"
    "          applied.push(`与${n.name}和亲，关系+20`);\n"
    "        }\n"
    "        if (world.envoy && world.envoy.from === n.id) world.envoy.decided = true;\n"
    "      } else if (kind === 'march') {"
)
if anchor in s and "kind === 'diplomacy'" not in s:
    s = s.replace(anchor, inject, 1)
    print('added diplomacy op')

io.open(p, 'w', encoding='utf-8').write(s)

# 记账员学会
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
old2 = "        '关系：[[world:bond a=aji b=wangpo type=母子 score=40]] —— 剧情里出现认亲、拜把子、结仇时用；score 正为亲近、负为仇怨。',"
new2 = old2 + "\n        '外交：[[world:diplomacy to=beidi action=pay]] —— 对邻国纳贡/通商/拒使/和亲时用；action 取 pay|trade|refuse|marry。',"
if old2 in s2 and 'world:diplomacy' not in s2:
    s2 = s2.replace(old2, new2)
    print('taught bookkeeper diplomacy')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
