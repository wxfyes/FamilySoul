/**
 * 全自动迎娶纳妾与名分落账推演引擎（Auto Matrimony Engine）
 *
 * 核心宗旨：
 *   1. 彻底终结“相公在剧情中成亲纳聘，事后还得手动找助理打补丁”的荒谬断层；
 *   2. 深度监听相公与红颜佳丽的交谈对话，当达成纳聘、收房、许为侧室/平妻等名分誓约时，
 *      全自动驱动通用大乾礼法引擎（executeMarriageAlliance）；
 *   3. 全自动核发大红官押婚书入相公行囊，全自动将女子登册入籍王府后宅家谱，
 *      全自动分配王府暖阁居所，全自动将重大成亲大事记落盘，形成完全自主的人生推进闭环！
 */

import { executeMarriageAlliance, isProtectedFemale } from './marriage.js';
import { itemsOf } from './items.js';

/**
 * 智能判定相公发言是否包含迎娶、纳妾、许为侧室或给予名分的明确誓约
 */
export function detectMatrimonyIntent(sayText) {
  const say = String(sayText || '').trim();
  if (!say) return null;

  // 排除疑问句、否定句（如“我何时说要纳你”、“纳妾的事以后再说”、“我不娶你”）
  if (/何时|岂会|怎么可能|以后再说|过阵子再说|别胡思乱想|不想|不纳|不娶|未曾想过|吗|呢|？|\?/.test(say)) {
    return null;
  }

  // 匹配明确纳聘、迎娶、收房词汇
  const mRank = /(?:纳你|迎你|娶你|做我|收你|聘你|给你名分|迎娶|纳聘|收房|过门|入我王家门|为妻|为妾|做小|平妻|正妻|侧室|如夫人|二房|三房|四房|名分)/.test(say);
  if (!mRank) return null;

  // 判定礼法位分
  let rank = '侧室如夫人';
  if (/平妻|并嫡|两头大|正室/.test(say)) {
    rank = '正室·平妻';
  } else if (/二房/.test(say)) {
    rank = '二房如夫人';
  } else if (/三房/.test(say)) {
    rank = '三房如夫人';
  } else if (/四房/.test(say)) {
    rank = '四房如夫人';
  } else if (/侧室/.test(say)) {
    rank = '侧室如夫人';
  } else if (/妾|做小|通房/.test(say)) {
    rank = '妾室';
  }

  // 提取明确点名（如“静儿”、“采云”、“如烟”、“含烟”）
  let targetName = null;
  const nameMatch = /(?:静儿|战静|采云|翟采云|柳如烟|如烟|柳含烟|含烟|紫嫣|刘文霞|杨采儿|采儿|苏小小|小翠)/.exec(say);
  if (nameMatch) {
    targetName = nameMatch[0];
  }

  return { ok: true, rank, targetName };
}

/**
 * 在每轮对话交互后，全自动捕获迎娶并执行礼法推演
 * @returns {{triggered: boolean, notice?: string, girlName?: string}}
 */
export function autoResolveMatrimony(world, { sayText = '', partnerId = null } = {}) {
  const intent = detectMatrimonyIntent(sayText);
  if (!intent) return { triggered: false };

  const me = world.actors?.husband;
  if (!me) return { triggered: false };

  world.actors = world.actors || {};

  // 寻找目标女子：优先发言指定人名，其次是当前对话伙伴 partnerId，再次是在场的未婚/和离佳丽
  let targetActor = null;
  if (intent.targetName) {
    targetActor = Object.values(world.actors).find((a) => a && (a.name === intent.targetName || a.name.includes(intent.targetName) || a.id.includes(intent.targetName)));
  }

  if (!targetActor && partnerId && world.actors[partnerId]) {
    const p = world.actors[partnerId];
    if (p.gender === 'female' && p.spouse !== 'husband') {
      targetActor = p;
    }
  }

  if (!targetActor) {
    // 扫描当前房间在场的女性佳丽
    const hereFemales = Object.values(world.actors).filter(
      (a) => a && !a.dead && a.gender === 'female' && a.location === me.location && a.spouse !== 'husband'
    );
    if (hereFemales.length === 1) {
      targetActor = hereFemales[0];
    } else if (hereFemales.length > 1) {
      // 优先选好感度最高或有亲密关系的
      hereFemales.sort((x, y) => (y.relations?.husband?.favor || 0) - (x.relations?.husband?.favor || 0));
      targetActor = hereFemales[0];
    }
  }

  if (!targetActor) return { triggered: false };

  // 若该女子已经是相公的妻子且名分相同，无需重复执行
  if (targetActor.spouse === 'husband' && targetActor.role === intent.rank) {
    return { triggered: false };
  }

  // 检查是否已有同名婚书，避免单场重复生成
  const husbandItems = itemsOf(world, 'husband');
  const hasCert = husbandItems.some((it) => it && String(it.name).includes(targetActor.name) && String(it.name).includes('婚书'));
  if (hasCert && targetActor.spouse === 'husband') {
    return { triggered: false };
  }

  // 执行通用大乾礼法引擎
  const weddingDay = Number(world.clock?.day) || 26;
  const res = executeMarriageAlliance(world, {
    wifeId: targetActor.id,
    rank: intent.rank,
    dowry: 100,
    day: weddingDay,
  });

  if (res?.ok) {
    // 全自动写入天下大事记
    world.milestones = Array.isArray(world.milestones) ? world.milestones : [];
    const msText = `【王府明媒聘纳·迎娶${targetActor.name}为${intent.rank}】：相公正式下聘迎娶${targetActor.name}入王府，礼成合卺，府衙红押登册，名正言顺列入王家后宅谱系，荣享一品军门内眷尊荣！`;
    if (!world.milestones.some((m) => String(m).includes(targetActor.name) && String(m).includes('婚书') || String(m).includes(targetActor.name) && String(m).includes('迎娶'))) {
      world.milestones.unshift(msText);
    }

    const notice = `（礼部与府衙官押文书已办妥，${targetActor.name}正式名分已入王府家谱，《${res.certName}》已稳妥收录入随身行囊，天下大事记已全自动落账！）`;
    return { triggered: true, notice, girlName: targetActor.name, certName: res.certName };
  }

  return { triggered: false };
}

