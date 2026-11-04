import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """              const hit = Object.values(world.actors || {}).find((a) => a && a.name === rawName);
              return hit?.name || rawName;"""
new = """              const hit = Object.values(world.actors || {}).find((a) => a && a.name === rawName);
              if (hit) return hit.name;
              // 老数据里可能是拼音/拉丁写法（jing'er）：按 id 片段认人
              const frag = rawName.toLowerCase().replace(/[^a-z]/g, '');
              if (frag.length >= 3) {
                const byIdFrag = Object.entries(world.actors || {}).find(([aid]) => aid.toLowerCase().includes(frag));
                if (byIdFrag?.[1]?.name) return byIdFrag[1].name;
              }
              return '不知是谁';"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加拼音/拉丁名兜底')
