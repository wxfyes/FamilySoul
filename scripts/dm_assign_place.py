import io

# ============ ① 天道为"没地点的约定"指派地点：[[place:片段|地点名]] ============
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 事情办完没有，由天道说了算：[[deal:片段|成]] 或 [[deal:片段|不成]]"
block = """    // 没地点的约定：让天道从"世上现有的地方"里指派一个，不许乱起名
    try {
      const wPlace = loadState(this.dataDir);
      const noPlace = (wPlace.appointments || []).filter((a) => a && !a.place);
      if (noPlace.length) {
        const names = Object.entries(wPlace.places || {})
          .filter(([, pl]) => pl && pl.name && !pl.private)
          .slice(0, 60)
          .map(([, pl]) => pl.name)
          .join('、');
        contextHintEarly += `（【约在哪】有约还没定地方。请从这些现成地点里挑一个最合场景的，附 [[place:约定片段|地点名]]：${names}。不许自己新起地名。）\\n`;
        const tags = String(reply || '').match(/\\[\\[place:([^\\]]+)\\]\\]/g);
        if (tags && tags.length) {
          for (const tag of tags) {
            const m = /\\[\\[place:(.+?)\\|([^\\]]+)\\]\\]/.exec(tag);
            if (!m) continue;
            const frag = String(m[1]).trim();
            const placeName = String(m[2]).trim();
            const hit = Object.entries(wPlace.places || {}).find(([, pl]) => pl && String(pl.name) === placeName);
            if (!hit) {
              console.log(`[Place] 天道想指派的「${placeName}」世上没有，不认`);
              continue;
            }
            const apt = (wPlace.appointments || []).find((x) => x && (String(x.text || '').includes(frag) || String(x.name || '') === frag));
            if (!apt) continue;
            apt.place = hit[0];
            wPlace.notes = Array.isArray(wPlace.notes) ? wPlace.notes : [];
            wPlace.notes.push({ day: wPlace.clock?.day, hour: wPlace.clock?.hour, text: `与${apt.name || '人'}的约定在「${placeName}」` });
            console.log(`[Place] 约定落在「${placeName}」`);
          }
          wPlace.notes = (wPlace.notes || []).slice(-40);
          saveState(this.dataDir, wPlace);
          reply = String(reply || '').replace(/\\[\\[place:[^\\]]+\\]\\]/g, '').trim();
        }
      }
    } catch { /* 忽略 */ }

    // 事情办完没有，由天道说了算：[[deal:片段|成]] 或 [[deal:片段|不成]]"""
if anchor in s and '[[place:' not in s:
    s = s.replace(anchor, block, 1)
    print('① 加地点指派')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
