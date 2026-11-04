import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "    // 天道要造物：[[build:地名|父地点名]]（父地点可省，默认他现在所在）"
block = """    // 差事：天道把"谁去办什么"记成差事，后面办到哪一步都能追
    try {
      const taskTags = String(reply || '').match(/\\[\\[task:([^\\]]+)\\]\\]/g);
      if (taskTags && taskTags.length) {
        const wT = loadState(this.dataDir);
        wT.tasks = Array.isArray(wT.tasks) ? wT.tasks : [];
        for (const tag of taskTags) {
          const parts = /\\[\\[task:([^|\\]]+)\\|([^|\\]]+)(?:\\|([^\\]]+))?\\]\\]/.exec(tag);
          if (!parts) continue;
          const whoName = String(parts[1] || '').trim();
          const what = String(parts[2] || '').trim().slice(0, 60);
          const days = Number(parts[3]) || 3;
          const who = Object.values(wT.actors || {}).find((a) => a && a.name === whoName);
          if (!who || !what) continue;
          wT.tasks.push({
            id: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            actorId: who.id,
            name: who.name,
            what,
            status: 'doing',
            startDay: wT.clock?.day || 1,
            dueDay: (wT.clock?.day || 1) + days,
            log: [],
          });
          console.log(`[Task] ${who.name} 领了差事：${what}`);
        }
        saveState(this.dataDir, wT);
        reply = String(reply || '').replace(/\\[\\[task:[^\\]]+\\]\\]/g, '').trim();
      }

      // 差事有进展：[[tasklog:片段|进展一句话]]
      const logTags = String(reply || '').match(/\\[\\[tasklog:([^\\]]+)\\]\\]/g);
      if (logTags && logTags.length) {
        const wL = loadState(this.dataDir);
        for (const tag of logTags) {
          const m = /\\[\\[tasklog:(.+?)\\|([^\\]]+)\\]\\]/.exec(tag);
          if (!m) continue;
          const frag = String(m[1]).trim();
          const note = String(m[2]).trim().slice(0, 60);
          const t = (wL.tasks || []).find((x) => x && x.status === 'doing' && (String(x.what).includes(frag) || String(x.name) === frag));
          if (t) {
            t.log = Array.isArray(t.log) ? t.log : [];
            t.log.push({ day: wL.clock?.day || 1, hour: wL.clock?.hour || 0, text: note });
            wL.notes = Array.isArray(wL.notes) ? wL.notes : [];
            wL.notes.push({ day: wL.clock?.day, hour: wL.clock?.hour, text: `${t.name}办差：${note}` });
          }
        }
        wL.notes = (wL.notes || []).slice(-40);
        saveState(this.dataDir, wL);
        reply = String(reply || '').replace(/\\[\\[tasklog:[^\\]]+\\]\\]/g, '').trim();
      }

      // 差事办完：[[taskdone:片段|结果]]
      const doneTags = String(reply || '').match(/\\[\\[taskdone:([^\\]]+)\\]\\]/g);
      if (doneTags && doneTags.length) {
        const wD = loadState(this.dataDir);
        for (const tag of doneTags) {
          const m = /\\[\\[taskdone:(.+?)\\|([^\\]]+)\\]\\]/.exec(tag);
          if (!m) continue;
          const frag = String(m[1]).trim();
          const result = String(m[2]).trim().slice(0, 60);
          const t = (wD.tasks || []).find((x) => x && x.status === 'doing' && (String(x.what).includes(frag) || String(x.name) === frag));
          if (t) {
            t.status = 'done';
            t.result = result;
            t.doneDay = wD.clock?.day || 1;
            wD.notes = Array.isArray(wD.notes) ? wD.notes : [];
            wD.notes.push({ day: wD.clock?.day, hour: wD.clock?.hour, text: `${t.name}办完了：${result}` });
          }
        }
        wD.notes = (wD.notes || []).slice(-40);
        saveState(this.dataDir, wD);
        reply = String(reply || '').replace(/\\[\\[taskdone:[^\\]]+\\]\\]/g, '').trim();
      }
    } catch { /* 忽略 */ }

    // 天道要造物：[[build:地名|父地点名]]（父地点可省，默认他现在所在）"""
if anchor in s and '[[task:' not in s:
    s = s.replace(anchor, block, 1)
    print('① 加差事记录')

# 提示词
old = "      contextHintEarly += '（【造物规矩】"
new = """      contextHintEarly += '（【差事规矩】相公吩咐谁去办一件事时，把它记成差事：[[task:谁|办什么|几天]]。后面有进展就 [[tasklog:片段|一句话]]，办成了 [[taskdone:片段|结果]]。谁去办由你按他的性情定，不必凑数。）\\n';
      contextHintEarly += '（【造物规矩】"""
if old in s and '【差事规矩】' not in s:
    s = s.replace(old, new, 1)
    print('② 差事提示')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
