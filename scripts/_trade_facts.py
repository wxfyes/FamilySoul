import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 府中兵事与存粮"
add = """    // 行当规矩与自家铺面的掌柜/伙计（给天道的事实）
    try {
      const wBz2 = loadState(this.dataDir);
      const props2 = Array.isArray(wBz2.assets?.properties) ? wBz2.assets.properties.filter(Boolean) : [];
      if (props2.length) {
        contextHintEarly += '（【行当规矩】东家出本钱、定大方向；掌柜管经营、用人、账目；伙计跑堂听掌柜的。小铺子老板自己就是掌柜，不另请人。东家与掌柜是两回事，绝不许混为一谈。）\\n';
        const lines2 = props2.slice(0, 6).map((p) => {
          const boss = Object.values(wBz2.actors || {}).find((a) => a && !a.dead && a.location === p.place && /掌柜/.test(String(a.role || '')));
          return `${p.name}（东家：相公；掌柜：${boss?.name || '未请'}）`;
        });
        contextHintEarly += `（【名下铺面】${lines2.join('；')}）\\n`;
      }
    } catch { /* 忽略 */ }

""" + anchor
if '【行当规矩】' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('行当事实')
