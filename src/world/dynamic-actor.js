/**
 * 剧情人物即时具象化引擎（Dynamic Actor Materialization）
 * 
 * 核心宗旨：
 *   言出法随，天下人物寻访即至，彻底杜绝“空口虚设 NPC”。
 *   大模型在对话推演中随口提及的人物（商贾、客商、故交、外官、侍妾、侠客、亲军等），
 *   以及相公在客户端【找人·寻访】搜索的剧情人物，即时具象化入世界账本，
 *   在地图有真身、在世间有落脚、能拜访、能召见、有羁绊。
 */

import { nextEvent } from './state.js';

// 排除非人名、系统词、地名与物产名词
const BLACKLIST = new Set([
  '相公', '夫君', '老爷', '大人', '官人', '妾身', '奴婢', '小的', '在下', '老夫', '朕', '本官',
  '天道', '系统', '朝廷', '临江', '临江府', '大乾', '江南', '江北', '两淮', '运河',
  '茶坊', '酒楼', '茶肆', '钱庄', '银两', '白银', '铜钱', '银票', '契纸', '尚方宝剑',
  '大门', '暖阁', '正房', '厢房', '后院', '中堂', '议事厅', '花厅', '公堂', '校场',
  '正妻', '平妻', '二房', '侧室', '通房', '外室', '小妾', '丫鬟', '伙计', '掌柜', '账房',
  '总兵', '提督', '知府', '县令', '参将', '都司', '守备', '团练', '千户', '百户', '把总',
]);

/** 清洗人名 */
export function cleanActorName(raw) {
  if (!raw) return '';
  let s = String(raw).trim()
    .replace(/^[【「『\[(（]/, '')
    .replace(/[】」』\])）]$/, '')
    .replace(/[·・].*$/, '') // 去掉角色标签后缀
    .replace(/^(知府|县令|提督|掌柜|伙计|姑娘|小姐|夫人|总商|商贾|把总|参将|少爷|老夫|东家|神医|道长|大师)/, '')
    .trim();
  return s;
}

/** 判断是否为合理的剧情人名（2-4字百家姓及古风名） */
export function isPotentialActorName(name) {
  if (!name || typeof name !== 'string') return false;
  const s = name.trim();
  if (s.length < 2 || s.length > 4) return false;
  if (BLACKLIST.has(s)) return false;
  if (/^[0-9a-zA-Z]+$/.test(s)) return false;
  // 必须全为中文
  if (!/^[\u4e00-\u9fa5]+$/.test(s)) return false;
  // 排除地名或建筑名后缀
  if (/[府州县城门楼房阁街巷河道山院庄铺坊栈]$/.test(s)) return false;
  // 排除银两数量
  if (/[两文石匹斤钱两]$/.test(s)) return false;
  return true;
}

/** 智能推导人物性别 */
export function inferGender(name, role = '') {
  const s = `${name} ${role}`;
  if (/[娘妹姐女姑妇婆妾闺媛姬娥婉娇婷蓉月采雪嫣静翠兰芸]/.test(s) || /千金|闺秀|才女|丫鬟|侍女|外室|如夫人/.test(s)) {
    return 'female';
  }
  return 'male';
}

/** 智能推导人物身份 */
export function inferRole(name, contextHint = '') {
  const s = `${name} ${contextHint}`;
  if (/知府|同知|通判|县令|知县|大人|抚台|道台/.test(s)) return '朝廷文官';
  if (/总兵|提督|参将|游击|都司|守备|把总|千总|统领|军门|总爷/.test(s)) return '武职军官';
  if (/粮台|粮道|巡检|捕头|捕快|差役|典吏|文书|师爷/.test(s)) return '府衙吏员';
  if (/掌柜|东家|商贾|总商|行首|老板|商人|坐商|客商/.test(s)) return '市井商贾';
  if (/大厨|厨娘|掌勺/.test(s)) return '庖厨名匠';
  if (/账房|先生|管事/.test(s)) return '账房管事';
  if (/千金|小姐|闺秀/.test(s)) return '名门闺秀';
  if (/丫鬟|丫头|使女/.test(s)) return '使唤丫鬟';
  if (/护院|家丁|武夫|游侠|剑客/.test(s)) return '江湖武客';
  return '市井人物';
}

/** 智能推导落脚地点 */
export function inferLocation(world, role, gender) {
  const places = world?.places || {};
  // 军政
  if (/军官|武职|总兵|提督|参将|把总|亲兵/.test(role)) {
    if (places.military_camp) return 'military_camp';
    if (places.dock) return 'dock';
    if (places.yamen) return 'yamen';
  }
  // 官署
  if (/文官|衙|吏|差役|知府|捕头/.test(role)) {
    if (places.yamen) return 'yamen';
    if (places.linjiang_court) return 'linjiang_court';
  }
  // 商贾
  if (/商|掌柜|东家/.test(role)) {
    if (places.canal_restaurant) return 'canal_restaurant';
    if (places.tea_market) return 'tea_market';
    if (places.tea_house) return 'tea_house';
  }
  // 女眷仕女
  if (gender === 'female' && /闺秀|千金/.test(role)) {
    if (places.wang_mansion__garden) return 'wang_mansion__garden';
    if (places.tea_house) return 'tea_house';
  }
  // 默认繁华长街或码头
  if (places.street) return 'street';
  if (places.dock) return 'dock';
  return Object.keys(places)[0] || 'street';
}

/**
 * 真正把剧情人物具象化进世界（单一入口，幂等）
 */
export function materializeNarrativeActor(world, {
  name,
  role = '',
  gender = '',
  city = '临江府',
  location = '',
  source = 'narrative',
  notes = '',
} = {}) {
  if (!world || !world.actors) return null;

  const pureName = cleanActorName(name);
  if (!pureName || !isPotentialActorName(pureName)) return null;

  // 1. 查重：世界中若已有同名或近似者，直接返回已存人物
  for (const [id, a] of Object.entries(world.actors)) {
    if (!a || a.dead) continue;
    if (a.name === pureName || a.name === name) return a;
    if (a.alias && Array.isArray(a.alias) && a.alias.includes(pureName)) return a;
  }

  // 2. 推导属性
  const finalGender = gender || inferGender(pureName, role);
  const finalRole = role || inferRole(pureName, notes);
  const finalLocation = (location && world.places?.[location]) ? location : inferLocation(world, finalRole, finalGender);

  // 3. 生成合法唯一 ID
  const id = `actor_dyn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const newActor = {
    id,
    name: pureName,
    role: finalRole,
    gender: finalGender,
    age: finalGender === 'female' ? 19 : 32,
    city,
    home: finalLocation,
    location: finalLocation,
    marital: finalGender === 'female' ? '待字闺中' : '已成家',
    origin: source || 'narrative_spawn',
    background: notes || `于江南风云际会中涌现之${finalRole}，常出没于${world.places?.[finalLocation]?.name || '临江市井'}。`,
    money: 10.0,
    relations: {
      husband: {
        trust: 50,
        favor: 50,
        desire: 0,
        respect: 60,
      },
    },
    spawnedAt: world.clock?.day || 26,
    dynamicSpawn: true,
  };

  world.actors[id] = newActor;

  // 4. 广播世界事件
  try {
    nextEvent(world, {
      action: 'actor_materialized',
      actor: id,
      place: finalLocation,
      payload: {
        name: pureName,
        role: finalRole,
        text: `【世情涌现】市井中出现新面孔【${finalRole}·${pureName}】，落脚于${world.places?.[finalLocation]?.name || '临江长街'}。`,
      },
      isPublic: true,
    });
  } catch {
    // 容错不阻断
  }

  return newActor;
}

/**
 * 从对话文本中扫描并具象化所有新出场人物
 */
export function autoMaterializeFromDialogue(world, text, { city = '临江府' } = {}) {
  if (!world || !text) return [];
  const spawned = [];

  // 匹配形如 【知府·杨慎之】、【掌柜·赵四】、【徽商汪德润】 或 台词引述人物
  const matches = String(text).match(/【([^】\n]{2,10})】/g) || [];
  for (const m of matches) {
    const raw = m.slice(1, -1).trim();
    if (/^天道|^系统|^内阁|^户部|^兵部/.test(raw)) continue;
    
    let role = '';
    let name = raw;
    if (raw.includes('·')) {
      const parts = raw.split('·');
      role = parts[0].trim();
      name = parts[1].trim();
    } else if (raw.includes(':') || raw.includes('：')) {
      const parts = raw.split(/[:：]/);
      role = parts[0].trim();
      name = parts[1].trim();
    }

    const pure = cleanActorName(name);
    if (isPotentialActorName(pure)) {
      const actor = materializeNarrativeActor(world, {
        name: pure,
        role,
        city,
        notes: `在大模型叙事交互中自然涌现登场：${raw}`,
      });
      if (actor && actor.dynamicSpawn) {
        spawned.push(actor);
      }
    }
  }

  return spawned;
}
