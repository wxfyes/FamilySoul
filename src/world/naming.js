/**
 * 命名规则：什么样的词才算"地名"
 *
 * 以前是在各处 if 里堆黑名单（"上方""旁边"…），那是补丁：
 * 每遇到一个新毛病就加一条，永远加不完。
 * 现在把判断收成一条规则，造物门、原文认地点、自检都调这里。
 *
 * 规则：
 *   ① 2~6 个汉字
 *   ② 不含疑问/指示/数量词（什么、哪里、某、一个…）
 *   ③ 不以方位词开头（上/下/里/外/前/后/旁/中/边/内）
 *   ④ 不是纯方位词或代词
 *   ⑤ 不是动词短语（去/来/走/到/找/说/看 开头）
 */

const FORBIDDEN_ANYWHERE = /(什么|哪里|哪儿|这里|那里|怎么|如何|是否|到底|多少|几个)/;
const LOCATIVE_HEAD = /^[上下里外前后旁中边内左右]/;
const PURE_LOCATIVE = /^(上方|下方|上面|下面|左边|右边|旁边|中间|里头|外头|前面|后面|里面|外面|上头|下头|这|那|这处|那处|此处|彼处)$/;
const VERB_HEAD = /^[去来往到找说看走跑回进出入拿抬搬]/;
const PLACE_SUFFIX = /(府|县|州|城|镇|村|街|巷|路|桥|坊|铺|店|楼|阁|轩|堂|园|院|房|屋|厅|馆|肆|栈|仓|码头|渡口|山|寺|庙|观|庵|亭|台|池|塘|庄|园|局|衙|门|坊|市|集|驿|馆)$/;

export function isPlaceName(name) {
  const n = String(name || '').replace(/\s/g, '');
  if (!/^[\u4e00-\u9fa5]{2,6}$/.test(n)) return { ok: false, why: '名字长度不对' };
  if (FORBIDDEN_ANYWHERE.test(n)) return { ok: false, why: '含疑问或指示词' };
  if (PURE_LOCATIVE.test(n)) return { ok: false, why: '纯方位词不是地名' };
  if (LOCATIVE_HEAD.test(n)) return { ok: false, why: '方位词开头不像地名' };
  if (VERB_HEAD.test(n)) return { ok: false, why: '动词开头不像地名' };
  return { ok: true, why: '', looksLikePlace: PLACE_SUFFIX.test(n) };
}

/** 从一句话里摘出"像是地名"的片段（给"原话认地点"用） */
export function extractPlaceCandidates(text) {
  const t = String(text || '');
  const out = [];
  const re = /(?:到|去|往|在|回|进|于|至)([\u4e00-\u9fa5]{2,6})/g;
  let m;
  while ((m = re.exec(t))) {
    const cand = m[1];
    if (isPlaceName(cand).ok) out.push(cand);
  }
  return out;
}
