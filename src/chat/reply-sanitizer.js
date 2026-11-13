/**
 * 回复清洗层（Step 2 抽取）
 *
 * 军规：
 *   ① 纯字符串进 → 纯字符串出，不读写世界状态（loadState / saveState 一律不进本模块）；
 *   ② 从 pet-service.js 原样搬出，清洗规则、正则、顺序一字未改；
 *   ③ 流式契约：本函数只处理"完整回复文本"，chatStream 的分块吐字在调用方完成，不受影响；
 *   ④ 依赖单向：chat/* ← pet-service.js，本模块不反向 import 主文件。
 */

const JSD_MUSIC_BASE = 'https://cdn.jsdelivr.net/gh/2321881815/music3@main';
const CLASSICAL_MUSIC_REGISTRY = {
  '青花瓷': `${JSD_MUSIC_BASE}/%E9%9D%92%E8%8A%B1%E7%93%B7-%E5%91%A8%E6%9D%B0%E4%BC%A6.mp3`,
  '东风破': `${JSD_MUSIC_BASE}/%E4%B8%9C%E9%A3%8E%E7%A0%B4-%E5%91%A8%E6%9D%B0%E4%BC%A6.mp3`,
  '七里香': `${JSD_MUSIC_BASE}/%E4%B8%83%E9%87%8C%E9%A6%99-%E5%91%A8%E6%9D%B0%E4%BC%A6.mp3`,
  '稻香': `${JSD_MUSIC_BASE}/%E7%A8%BB%E9%A6%99-%E5%91%A8%E6%9D%B0%E4%BC%A6.mp3`,
  '夜曲': `${JSD_MUSIC_BASE}/%E5%A4%9C%E6%9B%B2-%E5%91%A8%E6%9D%B0%E4%BC%A6.mp3`,
  '江南': `${JSD_MUSIC_BASE}/%E6%B1%9F%E5%8D%97-%E6%9E%97%E4%BF%8A%E6%9D%B0.mp3`,
  '人间惊鸿客': `${JSD_MUSIC_BASE}/%E4%BA%BA%E9%97%B4%E6%83%8A%E9%B8%BF%E5%AE%A2-%E5%8F%B6%E9%87%8C.mp3`,
  '四季予你': `${JSD_MUSIC_BASE}/%E5%9B%9B%E5%AD%A3%E4%BA%88%E4%BD%A0-%E7%A8%8B%E5%93%8D.mp3`,
  '惊鸿一面': `${JSD_MUSIC_BASE}/%E6%83%8A%E9%B8%BF%E4%B8%80%E9%9D%A2-%E8%AE%B8%E5%B5%A9-%E9%BB%84%E9%BE%84.mp3`,
  '晚风作酒': `${JSD_MUSIC_BASE}/%E6%99%9A%E9%A3%8E%E4%BD%9C%E9%85%92-L%EF%BC%88%E6%A1%83%E7%B1%BD%EF%BC%89-%E5%91%A8%E6%9E%97%E6%9E%AB-%E4%B8%89%E6%A5%A0.mp3`,
  '素颜': `${JSD_MUSIC_BASE}/%E7%B4%A0%E9%A2%9C-%E8%AE%B8%E5%B5%A9-%E4%BD%95%E6%9B%BC%E5%A9%B7.mp3`,
  '一路生花': `${JSD_MUSIC_BASE}/%E4%B8%80%E8%B7%AF%E7%94%9F%E8%8A%B1-%E6%B8%A9%E5%A5%95%E5%BF%83.mp3`,
};

export function cleanReply(rawReply, userText = '', isVideoCall = false) {
  let out = String(rawReply || '').trim();
  out = out.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  out = out.replace(/^\*\*([\s\S]+)\*\*$/, '$1').trim();
  out = out.replace(/^["“「『]([\s\S]*)["”」』]$/, '$1').trim();

  // 过滤掉所有中英文圆括号动作、神态、心理描写与旁白，只保留纯粹干净的角色对白
  out = out.replace(/[（(][^）)]*?[）)]/g, (match) => {
    if (match.includes('image:') || match.includes('music:') || match.includes('compare:')) return match;
    return '';
  }).replace(/^[>|]\s*/gm, '').replace(/[ \t]{2,}/g, ' ').replace(/([：:])\s*/g, '$1 ').replace(/^\s*[\r\n]+/gm, '').trim();

  // 彻底剔除大模型审题/思维链反刍（如“先说清楚谁能说，再让xx说”、“现场发言权调度”等）
  out = out.replace(/(?:^|\n)\s*(?:请?先(?:说清楚|理清|弄清|判断|明确)?谁(?:能|可以|在场)?(?:说|开口|回话|发言).*?再让.*?(?:说|开口|回话|发言)[：:。\s]*)+/g, '\n');
  out = out.replace(/(?:^|\n)\s*(?:【?(?:现场发言权调度|发言权调度|出场调度|导演调度|指名正主接话|妻妾同堂|领头人回话)[^】\n]*】?[：:。\s]*)+/g, '\n');
  out = out.replace(/(?:^|\n)\s*(?:由【?[^】\n]{1,10}】?(?:独立回答|率先上前|接话|开口|作答)[：:。\s]*)+/g, '\n');
  out = out.replace(/^(?:先说清楚谁能说|由.*?接话|本轮由.*?发言|谁在场谁开口)[：:。\s]*/gm, '');

  // 纠正大模型身世错乱：沈家血仇唯正妻沈婉儿独有，绝不许安在茶农之女林芸娘头上
  if (/【侧妾·芸娘】[：:]?[^【]*?(?:害我沈家|我沈家|沈家门被封|我爹爹.*核账.*亏空库银)/.test(out)) {
    out = out.replace(/【侧妾·芸娘】/g, '【正妻·婉儿】');
  }

  // 私密背后话防乱入：当相公明确对婉儿说“现在就我们俩/支走她了/你觉得芸娘怎么样/茶店给她打理你放心吗”时，剥离误入的其他角色台词与“先回避”废话
  const isWhisperingToWife = /(?:现在就我们俩|就咱们俩|只有我们俩|只剩我们|支走她|把她支走|趁她不在)/i.test(userText) ||
    /(?:你觉得|你说|你说说|你看|依你看).*?(?:芸娘|小翠|柳儿|她|这人).*?(?:怎么样|如何|可信|值得信任|放心|靠得住|靠谱)/i.test(userText) ||
    /(?:值得信任|你放心吗|交给她打理|给她打理|这人怎么样|她人怎么样)/i.test(userText);
  if (isWhisperingToWife && out.includes('【正妻·婉儿】')) {
    const blocks = out.split(/(?=【[^】]+】)/).map(s => s.trim()).filter(Boolean);
    const wifeBlocks = blocks.filter(b => b.startsWith('【正妻·婉儿】'));
    if (wifeBlocks.length > 0) {
      out = wifeBlocks.join('\n').replace(/妾身先回避了[。，、\s]*/g, '');
    }
  }

  // 纠正大模型下人抢戏：相公质问/心疼正妻，正妻沈婉儿必须第一个开口
  const questioningWifeRegex = /(?:不要下厨房|别下厨房|下什么厨房|不许下厨房|怎么跑了|为何跑了|昨晚叫你|叫你一起睡|一起睡.*跑|叫你没动静|叫你没反应|昨晚不是叫你|为何没动静|怎么没动静)/i;
  if (questioningWifeRegex.test(userText) && out.includes('【正妻·婉儿】') && !out.startsWith('【正妻·婉儿】')) {
    const matchWife = out.match(/【正妻·婉儿】[：:]?[^【]*/);
    if (matchWife) {
      const wifeBlock = matchWife[0].trim();
      const rest = out.replace(wifeBlock, '').trim();
      out = `${wifeBlock}\n${rest}`.trim();
    }
  }

  const userLow = String(userText || '').toLowerCase();
  const replyLow = out.toLowerCase();

  // 视频通话模式下，彻底清理掉所有 [image:...] / [sticker:...] 等标签，保持纯粹口语字幕
  if (isVideoCall) {
    out = out
      .replace(/\[(image|music|sticker|card|compare):[^\]]*\]/gi, '')
      .replace(/\[\s*emoji[:_][^\]]+\]/gi, '')
      .trim();
    return out;
  }

  // 1. 自拍兜底（仅当用户明确索要伴侣自拍画像且非系统视觉提示词时触发）
  const isSystemVisionPrompt = userLow.includes('【收到') || userLow.includes('发来的图片') || userLow.includes('发来了一张图片') || userLow.includes('实时照片') || userLow.includes('视讯');
  if (isSystemVisionPrompt) {
    out = out.replace(/\[image:[^\]]*\]/gi, '').trim();
  }
  const isImageIntent = !isSystemVisionPrompt && (
    /发自拍|来张自拍|自拍一张|帮我自拍|拍张自拍|看你自拍|发张美照|生成图片|生图|美女图|画个画/.test(userLow) ||
    /画给相公|画给你瞧|画给相公一人看/.test(replyLow)
  );
  if (isImageIntent && !out.includes('[image:')) {
    out += ' [image:selfie]';
  }

  // 2. 抚琴唱曲兜底
  const isMusicIntent = /唱首歌|唱歌|唱曲|听歌|抚琴|给相公唱|唱一个/.test(userLow) ||
                        /抚琴|浅唱一阕|为相公唱|唱一曲|焚香抚琴/.test(replyLow);
  if (isMusicIntent && !out.includes('[music:')) {
    let song = '青花瓷';
    const matchSong = (userLow + replyLow).match(/《([^》]+)》|相思引|明月几时有|水调歌头|半壶纱|琵琶语|高山流水|春江花月夜|清平调|红颜旧|锦鲤抄/);
    if (matchSong) {
      song = matchSong[1] || matchSong[0];
    }
    out += ` [music:${song}]`;
  }

  // 将 [image:selfie] 转为 Pollinations FLUX 超清古风自拍美图
  out = out.replace(/\[image:([^\]]+)\]/gi, (match, rawPrompt) => {
    let p = String(rawPrompt || '').trim();
    if (p.startsWith('http://') || p.startsWith('https://')) return `[image:${p}]`;
    let prompt = 'ancient Chinese noble lady, breathtaking beauty, delicate porcelain skin, elegant silk Hanfu, classical pavilion, photorealistic, 8k';
    if (p && p !== 'selfie' && p !== '自拍') {
      prompt = `${p}, ancient Chinese beauty, Hanfu, 8k, photorealistic`;
    }
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=1024&nologo=true&seed=${seed}`;
    return `[image:${url}]`;
  });

  // 将 [music:歌名] 转为高保真流式音频
  out = out.replace(/\[music:([^\]]+)\]/gi, (match, raw) => {
    const rawVal = String(raw || '').trim();
    if (rawVal.includes('|')) return `[music:${rawVal}]`;
    const cleanTitle = rawVal.replace(/[《》]/g, '').trim();
    let musicUrl = CLASSICAL_MUSIC_REGISTRY[cleanTitle];
    if (!musicUrl) {
      for (const [k, u] of Object.entries(CLASSICAL_MUSIC_REGISTRY)) {
        if (cleanTitle.includes(k) || k.includes(cleanTitle)) {
          musicUrl = u;
          break;
        }
      }
    }
    if (!musicUrl) {
      musicUrl = `${JSD_MUSIC_BASE}/%E9%9D%92%E8%8A%B1%E7%93%B7-%E5%91%A8%E6%9D%B0%E4%BC%A6.mp3`;
    }
    return `[music:${cleanTitle}|${musicUrl}]`;
  });

  return out;
}
