import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

if 'rumors:' not in s.split('arcs: world.arcs')[0]:
    old = "        arcs: world.arcs || {},"
    new = (
        "        arcs: world.arcs || {},\n"
        "        rumors: (world.rumors || []).slice(-10).map((r) => ({ text: r.text, weight: r.weight, reach: (r.heardBy || []).length, tone: r.tone, day: r.day })),\n"
        "        cases: (world.cases || []).slice(-8).map((c) => ({ id: c.id, who: c.who, against: c.against, claim: c.claim, status: c.status, verdict: c.verdict, reason: c.reason || '', hearing: c.hearing || '', day: c.day })),\n"
        "        guilds: Object.values(world.guilds || {}).map((g) => ({ name: g.name, head: world.actors?.[g.head]?.name || g.headName || '', dues: g.dues, power: g.power, attitude: g.attitude || '' })),\n"
        "        foreign: Object.values(world.foreign || {}).map((n) => ({ name: n.name, relation: n.relation, army: n.army, wants: n.wants })),\n"
        "        envoy: world.envoy || null,\n"
        "        garrisons: world.garrisons || {},\n"
        "        marches: (world.marches || []).map((m) => ({ to: m.to, count: m.count, arriveDay: m.arriveDay })),\n"
        "        imperialArmy: world.imperialArmy || null,"
    )
    if old in s:
        s = s.replace(old, new, 1)
        print('added new fields to admin world')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
