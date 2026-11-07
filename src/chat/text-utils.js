/**
 * 纯文本工具（Step 1 抽取）
 *
 * 军规：
 *   ① 本文件只放**纯函数**：零 IO、零全局状态、零副作用；
 *   ② 从 pet-service.js 原样搬出，逻辑一字未改；
 *   ③ 不反向 import pet-service.js（依赖单向：chat/* ← pet-service.js）。
 */

/** 中文数字 → 阿拉伯数字（十八、二十、一百二十…） */
export function cnNum(s) {
  const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const unit = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let cur = 0;
  for (const ch of String(s)) {
    if (map[ch] !== undefined) {
      cur = map[ch];
    } else if (unit[ch]) {
      total += (cur || 1) * unit[ch];
      cur = 0;
    }
  }
  return total + cur;
}

/** 语音/纯文本化：剥掉标签、表情、括号旁白，只留能念出来的话 */
export function stripForVoice(text) {
  return String(text || '')
    .replace(/\[(compare|image|music|sticker|card):[^\]]*\]/gi, '')
    .replace(/\[\s*emoji[:_][^\]]+\]/gi, '')
    .replace(/\{\s*emoji[:_][^\}]+\}/gi, '')
    .replace(/\bemoji[:_][a-zA-Z0-9_-]+/gi, '')
    .replace(/\[[^\]]{1,50}\]/g, '')
    .replace(/【[^】]{1,50}】/g, '')
    .replace(/[（(][^）)]{1,50}[）)]/g, '')
    .replace(/\*[^*]{1,50}\*/g, '')
    .replace(/~[^~]{1,30}~/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/，\s*，/g, '，')
    .trim();
}

/**
 * 合并同一个人连续写的多个分角标记：
 * 【侧妾·芸娘】：A / 【侧妾·芸娘】：B  →  【侧妾·芸娘】：A（换行）B
 * 这样客户端只渲染一个气泡，不会看起来像"连发三条"。
 */
export function mergeSameSpeaker(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  let lastSpeaker = null;
  for (const line of lines) {
    const m = line.match(/^\s*【([^】\n]{1,12})】\s*[:：]?\s*(.*)$/);
    if (m) {
      const speaker = m[1].trim();
      const body = (m[2] || '').trim();
      if (speaker === lastSpeaker) {
        if (body) out.push(body);
        continue;
      }
      lastSpeaker = speaker;
      out.push(`【${speaker}】：${body}`);
      continue;
    }
    if (line.trim() === '') lastSpeaker = null;
    out.push(line);
  }
  return out.join('\n');
}

/** 去掉分角前缀里的身份词，只留名字（"正妻·婉儿" → "婉儿"） */
export function cleanSpeakerLabel(s) {
  return String(s || '')
    .replace(/^[^\w\u4e00-\u9fa5]*?(?:正妻|侧妾|二房|如夫人|通房|丫鬟|伙计|掌柜|知县|老板娘|夫人|姑娘|姐姐|妹妹)[·・\s]*/, '')
    .trim();
}

/** 身份归一：把五花八门的 role/title 归成"正妻/二房/掌柜/郎中…"这类短标签 */
export function cleanRoleLabel(raw) {
  if (!raw) return '';
  let r = String(raw).trim();
  if (/正妻|正室|大娘子/.test(r)) return '正妻';
  if (/二房|如夫人|侧妾/.test(r)) return '二房';
  if (/丫鬟/.test(r)) return '丫鬟';
  if (/发妻/.test(r)) return '发妻';
  if (/老鸨/.test(r)) return '老鸨';
  if (/跑堂/.test(r)) return '跑堂';
  if (/伙计/.test(r)) return '伙计';
  if (/掌柜/.test(r)) {
    const m = r.match(/([^\s·]{0,4}掌柜)/);
    return m ? m[1].replace(/^(临江|苏州|杭州|扬州|松江|京城|洛阳|汴梁)/, '') : '掌柜';
  }
  if (/老板娘/.test(r)) {
    const m = r.match(/([^\s·]{0,4}老板娘)/);
    return m ? m[1].replace(/^(临江|苏州|杭州|扬州|松江|京城|洛阳|汴梁)/, '') : '老板娘';
  }
  if (/老板/.test(r)) {
    const m = r.match(/([^\s·]{0,4}老板)/);
    return m ? m[1].replace(/^(临江|苏州|杭州|扬州|松江|京城|洛阳|汴梁)/, '') : '老板';
  }
  if (/东家/.test(r)) return '东家';
  if (/郎中|大夫/.test(r)) return '郎中';
  if (/仵作/.test(r)) return '仵作';
  if (/知府/.test(r)) return '知府';
  if (/知县|县令/.test(r)) return '知县';
  if (/统领|侍卫/.test(r)) return '侍卫';
  if (/私兵|部曲/.test(r)) return '私兵';
  if (/护院|家丁/.test(r)) return '家丁';
  if (/帮主/.test(r)) return '帮主';
  if (/住持|方丈/.test(r)) return '住持';
  if (/先生|夫子/.test(r)) return '先生';
  if (/铁匠|木匠|石匠/.test(r)) return r.slice(-2);
  // 去除地名
  r = r.replace(/^(临江|苏州|杭州|扬州|松江|京城|洛阳|汴梁|太原|淮安|庐州|泰州|幽州|冀州|沧州|广州|潮州|桂州|成都|绵州|嘉州|济南|青州|登州|兖州|东昌|大同|平阳|蒲州|长安|凤翔|延安|江陵|潭州|襄阳|开封|南阳|归德|辽阳|金州|开原|兰州|凉州|秦州|昆明|大理|贵阳|福州|泉州|温州|宁波|洪州|赣州|吉安|徐州|宿州|府|县)+/, '');
  if (r.length > 5) r = r.slice(-4);
  return r;
}
