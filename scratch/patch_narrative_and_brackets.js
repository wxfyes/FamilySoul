import fs from 'node:fs';

let code = fs.readFileSync('src/pet-service.js', 'utf8').replace(/\r\n/g, '\n');

// 1. 在 processNarrativeTags 开头增加 relation 标签的古风中文转化
const relTarget = `    // 1. 习性变动：[[trait:谁|哪一样|+-数]] ➔ 落账并转为优雅古风中文展示`;
const relInsert = `    // 0. 好感/心境变动：[[world:relation ...]] 或 [[relation:谁|哪样|+-数]] ➔ 落账转古风中文展示
    try {
      const relMatches = [...reply.matchAll(/\\[\\[(?:world\\s*:\\s*)?relation(?:\\s*who=([^\\s\\]]+)\\s*field=([^\\s\\]]+)\\s*delta=([+-]?\\d+)|:\\s*([^|\\]]+?)\\s*\\|\\s*([^|\\]]+?)\\s*\\|\\s*([+-]?\\d+))[^\\]]*\\]\\]/gi)];
      if (relMatches.length > 0) {
        const wRel = loadState(dataDir);
        for (const m of relMatches) {
          const rawTag = m[0];
          const whoRaw = m[1] || m[4];
          const fieldRaw = m[2] || m[5];
          const deltaRaw = Number(m[3] || m[6]) || 0;
          const who = matchActor(wRel.actors, whoRaw);
          const whoName = who?.name || whoRaw;
          let cnField = '好感';
          const sign = deltaRaw > 0 ? \`+\${deltaRaw}\` : \`\${deltaRaw}\`;
          if (fieldRaw === 'trust') cnField = '信任';
          else if (fieldRaw === 'desire') cnField = '情愫';
          else if (fieldRaw === 'grievance') cnField = '怨怼';
          else if (fieldRaw === 'fear') cnField = '敬畏';
          else cnField = String(fieldRaw);

          let mood = '好感渐增';
          if (deltaRaw < 0) {
            mood = fieldRaw === 'grievance' ? '释怀释怨' : '心生防备';
          } else {
            if (fieldRaw === 'desire') mood = '情愫暗生';
            else if (fieldRaw === 'grievance') mood = '心生芥蒂';
          }
          const cnTag = \`\\n（【\${mood} · \${whoName}】\${cnField} \${sign}）\`;
          reply = reply.replace(rawTag, cnTag);
        }
      }
    } catch (err) {
      console.warn('[RelationTag] 转换失败：', err.message);
    }

    // 1. 习性变动：[[trait:谁|哪一样|+-数]] ➔ 落账并转为优雅古风中文展示`;

if (!code.includes(relTarget)) {
  console.error('relTarget not found!');
  process.exit(1);
}
code = code.replace(relTarget, relInsert);

// 2. 在 processNarrativeTags 末尾增加未闭合括号清理与修复
const bracketTarget = `    // 10. NPC 告辞离场：识别离场并走单一移动入口规范挪回自家或长街
    try {
      applyNpcDeparture(dataDir, reply, sayText);
    } catch (err) {
      console.warn('[Departure] 离场处理失败：', err.message);
    }

    return reply.trim();`;

const bracketReplace = `    // 10. NPC 告辞离场：识别离场并走单一移动入口规范挪回自家或长街
    try {
      applyNpcDeparture(dataDir, reply, sayText);
    } catch (err) {
      console.warn('[Departure] 离场处理失败：', err.message);
    }

    // 11. 孤立与未闭合中文括号治理（彻底杜绝末尾单挂 "（" 或残缺括号）
    reply = reply.replace(/[（(]\\s*$/g, '').trim();
    reply = reply.replace(/[（(]\\s*[）)]/g, '').trim();
    const openCount = (reply.match(/[（(]/g) || []).length;
    const closeCount = (reply.match(/[）)]/g) || []).length;
    if (openCount > closeCount) {
      const lastOpenIdx = Math.max(reply.lastIndexOf('（'), reply.lastIndexOf('('));
      if (lastOpenIdx >= 0) {
        const inside = reply.slice(lastOpenIdx + 1).trim();
        if (!inside || !/[\\u4e00-\\u9fa5]/.test(inside)) {
          reply = reply.slice(0, lastOpenIdx).trim();
        } else {
          reply = reply + '）';
        }
      }
    }

    return reply.trim();`;

if (!code.includes(bracketTarget)) {
  console.error('bracketTarget not found!');
  process.exit(1);
}
code = code.replace(bracketTarget, bracketReplace);

// 3. 强化 normalizeSpeakers 识别冒号行和漏方括号
const normTarget = `      return String(text || '').replace(/【([^】\\n]{1,10})】/g, (whole, name) => {
        const hit = map.get(String(name).trim());
        return hit ? \`【\${hit}】\` : whole;
      });`;

const normReplace = `      let res = String(text || '').replace(/【([^】\\n]{1,10})】/g, (whole, name) => {
        const hit = map.get(String(name).trim());
        return hit ? \`【\${hit}】\` : whole;
      });
      // 容错：如果模型输出 "张三：“台词”" 而漏了方括号，自动补齐 "【张三】：“台词”"
      for (const [name, label] of map.entries()) {
        if (name.length >= 2) {
          const rawRegex = new RegExp(\`(^|\\\\n)(\${name})\\\\s*[:：]\\\\s*([“"'])\`, 'g');
          res = res.replace(rawRegex, \`$1【\${label}】：$3\`);
        }
      }
      return res;`;

if (!code.includes(normTarget)) {
  console.error('normTarget not found!');
  process.exit(1);
}
code = code.replace(normTarget, normReplace);

// 4. 群戏提示词强化：严禁一人包含多人台词，严禁裸露冒号
const promptTarget = `        lines.push('  3. 每位开口的人物必须以「【姓名】：“台词”」严格标明分角，呈现真实生动的同场多人交涉！');`;
const promptReplace = `        lines.push('  3. 【每人独立分角】：每位开口的人物必须各自独立成行，且必须以「【姓名】：“台词”」严格标明分角，呈现真实生动的同场多人交涉！');
        lines.push('  4. 【严禁一人包揽多人对话】：绝不可在一个人名下把其他角色的应答塞在同一段或同一气泡里；');
        lines.push('  5. 【严禁裸露孤立冒号】：严禁输出如“： “台词””这样不带人名的残缺格式，下属领命或伙计应声也必须明确写出【某某】！');`;

if (!code.includes(promptTarget)) {
  console.error('promptTarget not found!');
  process.exit(1);
}
code = code.replace(promptTarget, promptReplace);

fs.writeFileSync('src/pet-service.js', code, 'utf8');
console.log('Successfully patched pet-service.js!');
