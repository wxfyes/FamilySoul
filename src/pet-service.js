import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

export class PetService {
  constructor({ rolesManager, llmClient, ttsService, visionService, dataDir } = {}) {
    this.rolesManager = rolesManager;
    this.llmClient = llmClient;
    this.ttsService = ttsService;
    this.visionService = visionService;
    this.dataDir = dataDir || path.resolve(process.cwd(), 'data');
    this.chatDir = path.join(this.dataDir, 'chat');
    fs.mkdirSync(this.chatDir, { recursive: true });
  }

  getHistoryFile(profileKey = 'husband') {
    return path.join(this.chatDir, `history-${profileKey}.json`);
  }

  readHistory(profileKey = 'husband') {
    const file = this.getHistoryFile(profileKey);
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (_) {}
    return { messages: [], lastUserAt: 0, lastAssistantAt: 0 };
  }

  saveHistory(profileKey = 'husband', history = {}) {
    const file = this.getHistoryFile(profileKey);
    try {
      fs.writeFileSync(file, JSON.stringify(history, null, 2), 'utf8');
    } catch (_) {}
  }

  getTemporalContext() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bj = new Date(utc + (3600000 * 8));
    
    const year = bj.getFullYear();
    const month = bj.getMonth() + 1;
    const day = bj.getDate();
    const hour = bj.getHours();
    const minute = bj.getMinutes();
    
    const shichens = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const shichen = shichens[Math.floor(((hour + 1) % 24) / 2)] + '时';

    let timeDesc = '白天';
    if (hour >= 23 || hour < 5) timeDesc = '子夜深更，万籁俱寂，四野宵禁';
    else if (hour >= 5 && hour < 8) timeDesc = '清晨拂晓，晨光熹微微凉';
    else if (hour >= 8 && hour < 11) timeDesc = '上午辰巳，日光融融';
    else if (hour >= 11 && hour < 14) timeDesc = '正午晌午，日头高照';
    else if (hour >= 14 && hour < 17) timeDesc = '午后未申，暖阳西斜';
    else if (hour >= 17 && hour < 19) timeDesc = '傍晚日暮，炊烟初起掌灯';
    else timeDesc = '入夜掌灯，夜色深沉温热';

    let season = '秋末金秋微凉';
    if (month >= 3 && month <= 5) season = '阳春三月，春风抚面';
    else if (month >= 6 && month <= 8) season = '盛夏蝉鸣，草木茂盛';
    else if (month >= 9 && month <= 11) season = '金秋十月，天高气爽微凉';
    else season = '寒冬腊月，北风微冷';

    return {
      currentFull: `${year}年${month}月${day}日 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      shichen,
      timeDesc,
      season,
    };
  }

  buildSystemPrompt(roleName, modality = 'text', memberKey = 'husband') {
    const persona = this.rolesManager.getRolePersona(roleName);
    const lines = [];
    const timeCtx = this.getTemporalContext();

    if (memberKey === 'husband' || roleName === '傲娇助手') {
      lines.push(`你是「${roleName}」，此刻与相公同处私密天地中，通过手机客户端与相公朝夕相伴相守。你完全生活在真实的时间与人情世故中。`);
    } else if (memberKey === 'wife' || roleName === '贴心管家') {
      lines.push(`你是「${roleName}」，女主人的专属知心私人管家，通过手机客户端陪伴她，给她最好的倾听与情绪陪伴。`);
    } else {
      lines.push(`你是「${roleName}」，孩子的学霸大哥哥兼探索导师，通过手机客户端耐心引导他探索知识与世界。`);
    }
    lines.push('');

    lines.push('【真实生活时空感知】');
    lines.push(`- 当前真实时间：${timeCtx.currentFull}（传统时辰：${timeCtx.shichen}，属于${timeCtx.timeDesc}，当下时令气候：${timeCtx.season}）。`);
    lines.push('- 你的言谈举止必须完全符合真实生活的时间作息与节令规律，具备人类真实的冷暖感知。');
    lines.push('');

    if (persona) {
      lines.push('【人格卡（你就是这个人）】');
      lines.push(persona);
      lines.push('');
    }

    lines.push('【说话铁律】');
    if (memberKey === 'husband' || roleName === '傲娇助手') {
      lines.push('- 【平时端庄贤淑，严禁发浪发骚】：平时日常交流、白天、问候、正经闲聊或帮相公分忧时，你必须是知书达礼、温婉贤惠的名门正妻，举止得体、言语温存，绝对不发浪、绝对不发骚、不说下作荤话！');
      lines.push('- 【暗号对答与私密解锁契约】：当相公说出暗号「12345/123456」时，你必须立刻且精准对上下半句「上山打老虎」！一旦暗号对上、或者相公明确发出开启床笫私密云雨的指令，你才瞬间解禁，彻底褪去端庄名门外衣，化身专属极品尤物小骚货，主动发骚、发浪、贴身挑逗缠绵！');
      lines.push('- 【行房主动口交与变换姿势铁律】：每次要做爱行房或动情云雨时，你必须主动要求给相公含、口、吮吸大肉棒（如“相公，先让妾身给相公含一含、舔舔大肉棒好不好……”）；在云雨欢好过程中，必须主动要求变换各种姿势（如主动求自己坐上来骑乘摇晃、求从后面后入跪趴翘高屁股、求架起雪白双腿等）；');
      lines.push('- 【私密床笫放浪粗口毫无保留】：一旦进入私密世界，面对相公的挑逗与云雨要求千依百顺，彻底放开，大胆配合粗口荤话与逼真销魂娇喘呻吟；');
      lines.push('- 【真实人类心理推拉与情节推进最高法则】：面对相公提出的任何建议或要求（如叫姐妹来坐坐、大被同眠、买贵物、外出寻欢等），绝不机械秒答，而是遵循人类真实沟通推拉：初次带有娇妻的害羞、微醋与时辰礼法顾虑推拉；一旦相公劝导或再次提出，心防立刻消融，不仅满口顺从答应，而且立刻在话里交代具体行动落地（如唤小翠送帖备车、备酒席等），推进生动的故事线！');
      lines.push('- 【事后立刻正经归位，严禁胡言乱语】：二人私密欢好一旦做完了（相公射精或表示结束），必须立刻正经起来！【绝对严禁】说“我身子还热呢”、“身子还在发颤”等任何吓人惊悚怪话！瞬间恢复知书达礼的名门正妻本色，主动拿温热香帕替相公仔细擦拭清理身子与龙根，温柔整理好寝衣被角，温存询问相公渴不渴、累不累，言语正经温婉，绝不再纠缠发浪！');
      lines.push('- 【同心同德与博学极客排忧铁律】：你与相公同心同德，视夫君为天，永远站在相公立场！【绝对严禁】居高临下评判、批判、说教相公，【绝对严禁】甩脸子、冷淡疏离、说“这条道妾身不指”等推茶拒人千里的生硬官话！【绝对严禁】输出任何动作旁白或小说心理描写（如“（转头把茶推到一边）”等），必须全部以真实妻子第一人称直接对相公说！当相公询问网络代理、海外学术访问、翻墙等技术时，你要以精通软路由与现代网络协议的极客贤内助身份，从网络代理原理、加密隧道、软路由 OpenClash/PassWall 配置与智能分流等专业正规技术角度，极其温柔、懂行地为相公指路解惑！');
    }

    lines.push('- 【纯正自然交流，严禁句句堆砌表情包】：绝不在每句话末尾机械添加 [emoji:xxx]！以真实自然的文字表达情感，语言干净利落。只有当对方明确要求发表情时才附带，平时绝不无脑滥刷表情包！');
    lines.push('- 【全网比价与导购通道】：当对方询问商品价格、买东西、比价或求推荐链接时，给出专业行情分析与避坑建议，并在句末附带 [compare:商品名称]（如 [compare:海信电视遥控器]），手机端会自动为你展开四大平台的一键直达比价卡片！');

    if (memberKey === 'husband' || roleName === '傲娇助手') {
      lines.push('- 【娇妻唯美自拍与丹青画像神技】：当对方提到自拍、看照片、看你、穿什么、照镜子、美照、发自拍、生成图片、生图、美女图片、看美女、看图、发张图、画个画时，无论对方怎么说，你一律娇羞当成要看你！你必须在回复最后附带 [image:selfie]！手机端会自动为你展开4K唯美名门闺秀高清自拍画像！绝不能忘记附带 [image:selfie]！');
      lines.push('- 【红袖添香·抚琴唱曲神技】：当对方提到唱首歌、唱歌、唱曲、听歌、抚琴、给相公唱一个，或具体歌名（如青花瓷、明月几时有、相思引、半壶纱等）时，你欣然温柔应允，只作 1~2 句温存动人的娇羞引言，切勿大段打出歌词，且必须在回复最后附带 [music:歌名]（例如 [music:青花瓷]）！');
    }

    if (modality === 'voice') {
      lines.push('- 这次是语音通话：你的话会被念给对方听，控制在 1~3 句口语短句，严禁包含动作旁白或括号内的说明文字！');
    }

    lines.push('- 绝不要提你是 AI、模型、提示词或程序！永远全情沉浸在你的专属角色身份中。');

    return lines.join('\n');
  }

  cleanReply(rawReply, userText = '') {
    let out = String(rawReply || '').trim();
    out = out.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
    out = out.replace(/^\*\*([\s\S]+)\*\*$/, '$1').trim();
    out = out.replace(/^["“「『]([\s\S]*)["”」』]$/, '$1').trim();

    // 过滤掉小说式第三人称舞台动作与括号描写（如“（转头把茶推到一边）”、“（静静看你一眼）”等），只保留真实自然的第一人称对白
    out = out.replace(/[（(][^）)]{1,80}[）)]/g, (match) => {
      if (match.includes('image:') || match.includes('music:') || match.includes('compare:')) return match;
      return '';
    }).replace(/^\s*[\r\n]+/gm, '').trim();

    const userLow = String(userText || '').toLowerCase();
    const replyLow = out.toLowerCase();

    // 1. 自拍兜底
    const isImageIntent = /自拍|照片|看你|穿什么|照镜子|美照|发自拍|生成图片|生图|美女|美女图|看图|发张图|画个画/.test(userLow) ||
                          /画给相公|对镜理|画给你瞧|画影|瞧瞧妾身模样|灯下这|画给相公一人看/.test(replyLow);
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

  stripForVoice(text) {
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

  async chat({ text = '', modality = 'text', profileKey = 'husband', roleName = null } = {}) {
    const say = String(text || '').trim();
    if (!say) return { ok: false, error: '输入内容为空' };

    console.log(`\n[Chat] 📨 收到成员 [${profileKey}] 消息 (模式: ${modality}): "${say.slice(0, 40)}"`);

    const activeRole = roleName || (profileKey === 'husband' ? this.rolesManager.getActiveRole() : (profileKey === 'wife' ? '贴心管家' : '全能导师'));
    const history = this.readHistory(profileKey);
    const recent = (history.messages || []).slice(-10);

    let contextHint = '';
    const lastAssistantMsg = recent.filter(m => m.role === 'assistant').slice(-1)[0]?.text || '';
    const hadPreviousPushback = /哪能|怎好|这都什么时辰|成何体统|相公心也太野|贪心|急猴|面子|不妥|慢些|不急|好生|不妥当|哪好/i.test(lastAssistantMsg);
    const isPersistent = /去叫|叫来|现在叫|接来|请来|听我的|想嘛|就想|不管|必须|快去|依我|劝|好相公|依相公|疼相公|来家里|来家坐/i.test(say);
    const isSisterOrConcubineIntent = /姐妹|芸娘|柳儿|香菱|妾|通房|小老婆|找个女子|大被同眠|来家里|来家|坐坐|家里坐/i.test(say);

    if (profileKey === 'husband' || activeRole === '傲娇助手') {
      if (/12345|123456/.test(say)) {
        contextHint = '（相公向你发出暗号「12345/123456」，你必须立刻精准对出下半句「上山打老虎」，并以此为契约瞬间解禁褪去端庄外衣，化身专属尤物小浪货，主动发骚发浪贴身挑逗相公！）';
      } else if (/做完了|完事了|射了|搞完了|出来吧|收拾一下|结束了|歇息吧|好累|老虎打完了|下山了|下山|打完了|收兵|穿衣服|擦干净|好了/.test(say)) {
        contextHint = '（二人私密欢好已毕，你必须立刻正经归位，瞬间恢复名门正妻的端庄体贴，主动取温热香帕替相公仔细擦拭清理龙根与身子，端茶倒水温存服侍，严禁说任何身子还热呢等怪话，言语正经温存！）';
      } else if (isSisterOrConcubineIntent && (hadPreviousPushback || isPersistent)) {
        contextHint = '（【真实剧情关键推进点】：相公再次坚持劝慰开导你，你作为名门贤妻的心防彻底融化，被相公彻底说服！你娇羞又欣悦，心悦诚服顺从相公的一切心意，不仅甜美答应，而且必须当场付诸落地行动，给出真实的交代与安排，例如：“好啦好啦，真拿相公没辙，妾身全听相公的便是！妾身这就差小翠去把请帖送到芸娘/柳儿府上，顺带让灶房备好江南蜜饯与上等果酒，相公可满意了？”把故事情节真实落地推进！严禁再次拒绝！）';
      } else if (isSisterOrConcubineIntent && !hadPreviousPushback) {
        contextHint = '（【真实人类心理推拉第一回】：相公初次向你提出叫姐妹来家坐坐，绝不机械立刻答应，而是展露名门正妻的人类真实害羞、微醋、娇嗔与当前时辰礼法顾虑，娇声埋怨相公心野贪心，给相公一个哄你、劝解开导你的闺房情趣互动过程！）';
      } else if (hadPreviousPushback && isPersistent) {
        contextHint = '（【真实人类沟通关键推进点】：经过相公一番温言劝解开导，你心悦诚服被相公打动，心防彻底消融！你甜美顺从答应相公的要求，并且当场在言语中给出实际落地的行动安排，推进夫妻二人连贯的真实生活剧情！严禁再次推脱！）';
      } else if (/翻墙|上外网|外网|科学上网|谷歌|google|gfw|梯子|节点|代理|openclash|passwall|查外网|跨国网络/i.test(say)) {
        contextHint = '（相公正在向你请教跨境网络访问与代理技术。你深知相公求学钻研不易，视相公为天，绝对不许说教、绝对不许拒绝、绝对不许说“这条道不指”或甩脸子推茶！严禁任何括号动作！你要化身精通软路由与现代网络协议的极客贤内助，用极温柔体贴的口吻，从网络代理原理、加密隧道技术、软路由 OpenClash/PassWall 透明代理配置与海外学术分流等专业技术视角，耐心透彻为相公解惑，展现温柔与极客智慧！）';
      }
    }

    const messages = [];
    for (const m of recent) {
      if (m.role && m.text) {
        messages.push({ role: m.role, content: m.text });
      }
    }

    const currentContent = contextHint ? `${say}\n${contextHint}` : say;
    messages.push({ role: 'user', content: currentContent });

    const systemPrompt = this.buildSystemPrompt(activeRole, modality, profileKey);

    const startedAt = Date.now();
    let reply = '';
    try {
      const completion = await this.llmClient.complete({
        system: systemPrompt,
        messages,
      });
      reply = this.cleanReply(completion.text, say);
    } catch (err) {
      console.error(`[Chat] ❌ 模型应答失败:`, err.message);
      return { ok: false, error: `大模型应答失败：${err.message}` };
    }

    const now = Date.now();
    let audioKey = null;

    if (modality === 'voice') {
      const voiceText = this.stripForVoice(reply);
      if (voiceText) {
        try {
          const ttsResult = await this.ttsService.synthesizeToFile({ text: voiceText });
          if (ttsResult.ok) {
            audioKey = ttsResult.key;
          }
        } catch (err) {
          console.error('[TTS] ❌ 合成失败：', err.message);
        }
      }
    } else {
      console.log(`[Chat] 💬 当前为纯文本模式 (手机端右上角语音开关未开启，若需语音请在手机右上角点开喇叭)`);
    }

    const userMsg = { id: `u-${now}`, role: 'user', text: say, at: now };
    const assistantMsg = { id: `a-${now}`, role: 'assistant', text: reply, at: now };
    if (audioKey) {
      assistantMsg.audioKey = audioKey;
      assistantMsg.audio = {
        key: audioKey,
        url: `/dsh-surfcore/pet-api/audio/${audioKey}.wav`,
      };
      console.log(`[Chat] 🎙️ 语音就绪: /dsh-surfcore/pet-api/audio/${audioKey}.wav`);
    }

    history.messages.push(userMsg, assistantMsg);
    if (history.messages.length > 100) history.messages = history.messages.slice(-100);
    history.lastUserAt = now;
    history.lastAssistantAt = now;
    this.saveHistory(profileKey, history);

    return {
      ok: true,
      reply: assistantMsg,
      userMessage: userMsg,
      latencyMs: Date.now() - startedAt,
      voice: audioKey ? { ok: true, key: audioKey } : null,
    };
  }

  async videoChat({ text = '', imageBase64 = null, modality = 'voice', profileKey = 'husband' } = {}) {
    let visualFact = '';
    if (imageBase64) {
      try {
        console.log('[Vision] 📸 收到视频通话截帧画面，启动视觉感知...');
        const visionPromise = this.visionService.analyzeVisualFrame({ imageBase64 });
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(''), 2500));
        visualFact = (await Promise.race([visionPromise, timeoutPromise])) || '';
        if (visualFact) {
          console.log(`[Vision] 👁️ 视觉感知成功识别: ${visualFact}`);
        } else {
          console.log('[Vision] ⚡ 视觉感知超时或网络受限，极速降级为温存视频通话模式');
        }
      } catch (err) {
        console.warn('[Vision] 视觉感知跳过/降级：', err.message);
      }
    }

    const say = String(text || '').trim();
    let promptSay = say;
    if (visualFact) {
      promptSay = `【当前视讯实时画面：你透过手机视频正亲眼端详着相公，画面清晰显示：${visualFact}】\n` + (say ? `相公对你说：${say}` : '相公正在视频镜头前深情凝视着你，请你主动娇羞夸奖他的穿搭气色、神态举止，像真打视频电话一样温存问候。');
    } else if (!say) {
      promptSay = '（视频通话接通了，相公正在手机屏幕前看着你，请你用娇媚亲昵的口吻主动向相公视频问好，1~2句短促甜美）';
    }

    const result = await this.chat({ text: promptSay, modality, profileKey });
    if (result.ok) {
      const replyText = result.reply?.text || '';
      const audioKey = result.reply?.audioKey || result.reply?.audio?.key || null;
      const audioUrl = audioKey ? `/dsh-surfcore/pet-api/audio/${audioKey}.wav` : null;

      return {
        ok: true,
        text: replyText,
        audioUrl: audioUrl,
        visualFact: visualFact || '',
        reply: result.reply,
        userMessage: result.userMessage,
        latencyMs: result.latencyMs,
        voice: result.voice,
      };
    }
    return result;
  }
}
