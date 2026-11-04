/**
 * FamilySoul 天道选角配音中心（Voice Casting Engine）
 *
 * 核心军规：
 * 1. 彻底禁止个案特判，基于【性别、年龄段、身份角色】统一推导声线；
 * 2. 微软 Edge-TTS 原生免代理纯直连，利用现成官方高品质 Neural 音色及 pitch/rate 微调；
 * 3. 彻底治愈“女角色发出男声”或“全天下所有人一个声音”的违和感。
 */

// 微软 Edge-TTS 官方可用优质音色
export const VOICES = {
  // ── 女性音色 ──
  FEMALE_SWEET: 'zh-CN-XiaoxiaoNeural',   // 娇甜柔润（沈婉儿、温婉名门）
  FEMALE_GIRL: 'zh-CN-XiaoyiNeural',      // 活泼明朗（少女、丫鬟、江湖女侠、年轻掌柜娘子）
  
  // ── 男性音色 ──
  MALE_SCHOLAR: 'zh-CN-YunxiNeural',     // 阳光清亮少年/书生（年轻少侠、子非、同门师兄）
  MALE_DEEP: 'zh-CN-YunjianNeural',      // 沉稳成熟帅气（大侠、巡捕、军将、男管家）
  MALE_LIVELY: 'zh-CN-YunyangNeural',    // 专业干练市井（店小二、伙计、差役、说书人）
  MALE_KID: 'zh-CN-YunxiaNeural',        // 天真顽童
};

/**
 * 根据发言人姓名、角色档案、世界状态推导最契合的声线与音调
 *
 * @param {Object} params
 * @param {string} [params.speakerName] - 发言人姓名（如“柳婶”、“周有福”、“沈婉儿”）
 * @param {Object} [params.actor] - 发言人 Actor 对象（含 gender, age, role）
 * @param {Object} [params.world] - 世界状态数据
 * @param {string} [params.profileKey] - 当前玩家的账号身份
 * @returns {{ voice: string, pitch: string, rate: string, label: string }}
 */
export function resolveVoiceCasting({ speakerName = '', actor = null, world = null, profileKey = 'husband' } = {}) {
  const cleanName = String(speakerName || '').trim().replace(/^[^\w\u4e00-\u9fa5]+|[^\w\u4e00-\u9fa5]+$/g, '');
  
  // 1. 如果没传 actor，尝试从 world.actors 中按名字反查
  let targetActor = actor;
  if (!targetActor && cleanName && world && world.actors) {
    for (const act of Object.values(world.actors)) {
      if (act && (act.name === cleanName || (cleanName.length >= 2 && act.name?.includes(cleanName)))) {
        targetActor = act;
        break;
      }
    }
  }

  // 2. 特殊核心伴侣名分优先匹配（名门正妻 沈婉儿 / 二房 林芸娘）
  if (/婉儿|沈婉儿/.test(cleanName)) {
    return {
      voice: VOICES.FEMALE_SWEET,
      pitch: '+0Hz',
      rate: '+0%',
      label: '娇甜正妻沈婉儿',
    };
  }
  if (/芸娘|林芸娘/.test(cleanName)) {
    return {
      voice: VOICES.FEMALE_SWEET,
      pitch: '+2Hz',
      rate: '-5%',
      label: '温婉娇怯林芸娘',
    };
  }

  // 3. 提取特征属性：性别、年龄、身份
  let gender = targetActor?.gender || '';
  let age = typeof targetActor?.age === 'number' ? targetActor.age : null;
  const role = String(targetActor?.role || '').trim();
  const nameAndRole = `${cleanName} ${role}`;

  // 4. 若性别未定，从称谓特征推断
  if (!gender) {
    if (/娘|女|妹|姐|妻|妾|娥|雪|嫣|翠|婆|婶|姨|姑|丫鬟|侍女|闺秀|老妪|娘子|妇/.test(nameAndRole)) {
      gender = 'female';
    } else if (/爷|伯|叔|翁|公|僧|道长|秀才|书生|生|小二|伙计|捕快|账房|掌柜|东家|相公|少爷|郎|汉|兄|弟|侠|客官/.test(nameAndRole)) {
      gender = 'male';
    }
  }

  // 5. 若年龄未定，从称谓特征推断年龄层
  let isElder = false;
  let isChild = false;
  if (age !== null) {
    if (age >= 50) isElder = true;
    else if (age <= 14) isChild = true;
  } else {
    if (/婆|婶|老|翁|公|叟|老妪|太夫人|老账房|族长|阿婆/.test(nameAndRole)) {
      isElder = true;
    } else if (/童|娃|小儿|顽童|稚子/.test(nameAndRole)) {
      isChild = true;
    }
  }

  // ── 女性分类派发 ──
  if (gender === 'female') {
    // 老年女性（如 柳婶、唐婆、算命阿婆、老妪）
    if (isElder) {
      return {
        voice: VOICES.FEMALE_GIRL,
        pitch: '-6Hz',
        rate: '-8%',
        label: `${cleanName || '老妇'}（苍老慈祥老妪）`,
      };
    }
    // 少女 / 丫鬟 / 活泼女店家
    if (isChild || /丫鬟|小妹|丫头|春|翠|灵/.test(nameAndRole)) {
      return {
        voice: VOICES.FEMALE_GIRL,
        pitch: '+3Hz',
        rate: '+5%',
        label: `${cleanName || '少女'}（灵动活泼少女）`,
      };
    }
    // 普通成年女性 / 佳人 / 掌柜娘子
    return {
      voice: VOICES.FEMALE_GIRL,
      pitch: '+0Hz',
      rate: '+0%',
      label: `${cleanName || '女子'}（清澈明朗佳人）`,
    };
  }

  // ── 男性分类派发 ──
  if (gender === 'male') {
    // 孩童男声
    if (isChild) {
      return {
        voice: VOICES.MALE_KID,
        pitch: '+2Hz',
        rate: '+5%',
        label: `${cleanName || '男童'}（天真幼童）`,
      };
    }
    // 老年男性（如 周有福、赵老账房、老族长、老翁、老僧）
    if (isElder) {
      return {
        voice: VOICES.MALE_DEEP,
        pitch: '-8Hz',
        rate: '-10%',
        label: `${cleanName || '老伯'}（沉稳沧桑老成）`,
      };
    }
    // 市井伙计 / 店小二 / 跑堂走卒
    if (/小二|伙计|跑堂|差役|脚夫|说书/.test(nameAndRole)) {
      return {
        voice: VOICES.MALE_LIVELY,
        pitch: '+0Hz',
        rate: '+6%',
        label: `${cleanName || '伙计'}（市井干练清脆）`,
      };
    }
    // 青年书生 / 侠客 / 少爷
    if (/书生|秀才|公子|少爷|剑客|侠|道童/.test(nameAndRole)) {
      return {
        voice: VOICES.MALE_SCHOLAR,
        pitch: '+0Hz',
        rate: '+0%',
        label: `${cleanName || '侠士'}（清俊儒雅青年）`,
      };
    }
    // 成熟男子 / 掌柜 / 捕快 / 管家
    return {
      voice: VOICES.MALE_DEEP,
      pitch: '-2Hz',
      rate: '+0%',
      label: `${cleanName || '壮汉'}（沉稳浑厚男音）`,
    };
  }

  // ── 兜底分支（完全无法确定姓名与性别）──
  if (profileKey === 'husband') {
    return {
      voice: VOICES.FEMALE_SWEET,
      pitch: '+0Hz',
      rate: '+0%',
      label: '名门正妻（默认相公视角）',
    };
  }
  if (profileKey === 'wife') {
    return {
      voice: VOICES.MALE_DEEP,
      pitch: '+0Hz',
      rate: '+0%',
      label: '贴心管家（默认夫人视角）',
    };
  }

  // 自由玩家视角兜底（如 子非、离析、紫嫣）
  return {
    voice: VOICES.FEMALE_GIRL,
    pitch: '+0Hz',
    rate: '+0%',
    label: '江湖佳人（自由角色默认）',
  };
}
