import fs from 'node:fs';

let content = fs.readFileSync('src/pet-service.js', 'utf8');

// 1. 修改声明支持 worldOps
content = content.replace(
  'processNarrativeTags(replyText, sayText = \'\') {',
  'processNarrativeTags(replyText, sayText = \'\', worldOps = []) {'
);

// 2. 在 860 行加入 relation 提示和未闭合括号治理
const target860 = `    // 9. 最终兜底：剔除任何未识别的英文系统标签，绝不向客户端吐裸露英文 [[...]]
    reply = reply.replace(/\\[\\[[a-zA-Z0-9_]+:[^\\]]*\\]\\]/g, \'\').replace(/\\[\\[[^\\]]*\\]\\]/g, \'\');

    // 10. NPC 告辞离场：识别离场并走单一移动入口规范挪回自家或长街
    try {
      applyNpcDeparture(dataDir, reply, sayText);
    } catch (err) {
      console.warn(\'[Departure] 离场处理失败：\', err.message);
    }`;

const replace860 = `    // 9. 好感与心绪变动反馈（来自 realOps 中的 relation 操作，让玩家每次互动得到温暖及时的天道回执反馈）
    try {
      const relOps = (worldOps || []).filter((o) => o && o.kind === 'relation' && o.args);
      if (relOps.length > 0) {
        const wRel = loadState(dataDir);
        for (const op of relOps) {
          const whoId = op.args.who;
          const field = String(op.args.field || 'trust');
          const delta = Number(op.args.delta) || 0;
          if (!delta) continue;
          const who = matchActor(wRel.actors, whoId);
          const targetName = who?.name || whoId;
          const fieldName = {
            trust: '信任',
            desire: '好感',
            fear: '敬畏',
            grievance: '幽怨',
          }[field] || '心绪';
          const sign = delta > 0 ? \`+\${delta}\` : String(delta);
          if (delta > 0) {
            reply += \`\\n（【好感渐增 · \${targetName}】\${fieldName} \${sign}）\`;
          } else {
            reply += \`\\n（【心绪微沉 · \${targetName}】\${fieldName} \${sign}）\`;
          }
        }
      }
    } catch (err) {
      console.warn('[RelationHint] 处理失败：', err.message);
    }

    // 10. 最终兜底：剔除任何未识别的英文系统标签，绝不向客户端吐裸露英文 [[...]]
    reply = reply.replace(/\\[\\[[a-zA-Z0-9_]+:[^\\]]*\\]\\]/g, \'\').replace(/\\[\\[[^\\]]*\\]\\]/g, \'\');

    // 11. 残缺未闭合中文括号自动修复：绝不留残破的「（」给用户
    try {
      reply = reply.replace(/[（(]\\s*$/, '').trim();
      const openCount = (reply.match(/[（(]/g) || []).length;
      const closeCount = (reply.match(/[）)]/g) || []).length;
      if (openCount > closeCount) {
        reply = reply + '）'.repeat(openCount - closeCount);
      }
    } catch {}

    // 12. NPC 告辞离场：识别离场并走单一移动入口规范挪回自家或长街
    try {
      applyNpcDeparture(dataDir, reply, sayText);
    } catch (err) {
      console.warn('[Departure] 离场处理失败：', err.message);
    }`;

content = content.replace(target860, replace860);

// 3. chat 调用点传递 realOps
content = content.replace(
  'reply = this.processNarrativeTags(reply, say);',
  'reply = this.processNarrativeTags(reply, say, realOps);'
);

fs.writeFileSync('src/pet-service.js', content, 'utf8');
console.log('PATCHED_ALL_OK');
