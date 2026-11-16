
/**
 * 全自动大事记智能捕获中枢（Auto Chronicle Engine）
 *
 * 核心宗旨：
 *   1. 人生模拟必须拥有自发、长时、有因有果的连续性，拒绝事后人工打补丁；
 *   2. 自动检测相公在世间创下的重大基业、官职晋升、军功大捷、名媛联姻、和离昭雪；
 *   3. 全自动生成庄严大气的古风大事记文本，落盘到 world.milestones 与 data/world/milestones.json；
 *   4. 确保手机端客户端【大事记】永远实时映射相公的真实人生进展，生机勃勃、绝不掉线！
 */

import fs from 'node:fs';
import path from 'node:path';
import { getHusbandOfficialInfo } from './items.js';

/**
 * 全自动捕获世界重大事实并同步大事记账本
 * @param {object} world 世界状态
 * @param {string} dataDir 数据目录（可选，用于持久化同步 milestones.json）
 * @returns {string[]} 新增的大事记条目
 */
export function syncAutoChronicle(world, dataDir = null) {
  if (!world) return [];
  world.milestones = Array.isArray(world.milestones) ? world.milestones : [];
  // 先行按文本权威去重，防止历史沉淀重复条目
  const seenExisting = new Set();
  world.milestones = world.milestones.filter((m) => {
    const s = typeof m === 'string' ? m : (m?.text || m?.title || '');
    if (!s || seenExisting.has(s.trim())) return false;
    seenExisting.add(s.trim());
    return true;
  });
  const added = [];

  const addIfAbsent = (matcher, milestoneText) => {
    const has = world.milestones.some((m) => {
      const s = typeof m === 'string' ? m : (m?.text || m?.title || '');
      return s.includes(matcher);
    });
    if (!has) {
      world.milestones.unshift(milestoneText);
      added.push(milestoneText);
    }
  };

  // 1. 官职武勋大业全自动捕获
  const offInfo = getHusbandOfficialInfo(world);
  if (offInfo.hasOffice) {
    if (offInfo.highestTitle.includes('太保') || offInfo.officeKey === 'taizitaibao') {
      addIfAbsent(
        '从一品东宫三师太子太保',
        '【天子朱批实授·从一品东宫三师太子太保（加赐紫金鱼袋·见驾不拜·位在六部之上）】：当今天子萧景隆御笔亲批《天子朱批·太子太保实授敕命圣旨》，加赐东宫三师《紫金鱼袋与太保金印》入随身行囊！相公位列东宫三师，朝会班列六部尚书之上，见驾不拜，总领水陆兵戈与朝堂整肃纠察大权，威临九卿百官！'
      );
    }
    if (offInfo.highestTitle.includes('提督') || offInfo.rank.includes('一品')) {
      addIfAbsent(
        '江南水陆提督总兵官',
        '【天子钦授从一品·江南水陆提督总兵官（钦赐尚方宝剑·代天巡狩）】：当今天子圣谕褒嘉，叙相公经世武勋与靖难大功，破格特恩实授【从一品武官·江南水陆提督总兵官】，总督江南江北水陆诸镇官军兵马，开府建牙、加赐天子尚方宝剑（副将以下先斩后奏），节制沿江沿淮大营与天下水师，合朝文武官绅百姓莫不钦服拜谒。'
      );
    } else if (offInfo.highestTitle.includes('都司')) {
      addIfAbsent(
        '临江府都司',
        '【朝廷兵部实授正四品·临江府都司（钦颁告身敕牒与紫金虎符）】：相公王甯率麾下精兵连破六股巨寇，功勋卓著，由临江府乡勇团练使、从五品临江府守备一路晋升至【正四品武官·临江府都司】！朝廷兵部武选司正式下达敕牒与调兵虎符入随身行囊，合城官民莫不钦服。'
      );
    }
  }

  // 2. 京师开府建牙全自动捕获
  const me = world.actors?.husband;
  const isCapitalEra = me?.city === '京城' || (me?.location && String(me.location).startsWith('capital_'));
  if (isCapitalEra) {
    addIfAbsent(
      '迁驻京师提督王府正殿',
      '【举家随行迁驻京师提督王府正殿】：相公奉旨开府建牙，颁家眷随行大令，率正妻沈婉儿、平妻杨采儿、侧室林芸娘、侧室崔婉宁全家启程迁驻京师提督王府正殿，荣享一品军门尊荣，亲卫统领赵雷与百名铁甲亲骑一路执戈护卫。'
    );
  }

  // 3. 婚姻家谱联姻大事全自动捕获（遍历后宅谱系）
  for (const m of world.marriages || []) {
    if (!m || !m.name) continue;
    const wName = m.name || m.wifeName;
    const rName = m.rank || '侧室';
    addIfAbsent(
      wName,
      `【王府明媒聘纳·迎娶${wName}为${rName}】：相公正式下聘迎娶${wName}入府，出具府衙官押红帖婚书，名正言顺列入王府后宅家谱，两姓结为秦晋之好！`
    );
  }

  // 4. 重大和离与昭雪大案全自动捕获
  for (const a of Object.values(world.actors || {})) {
    if (!a || !a.name) continue;
    if (a.divorced && (a.name === '静儿' || a.name === '柳如烟')) {
      addIfAbsent(
        `${a.name}官准和离`,
        `【公堂断案·官准${a.name}和离放妻文书立案】：相公威仪压阵临江府公堂，核准官府红押《放妻和离文书》，彻底脱离旧籍束缚，重获自由自立之身！`
      );
    }
  }

  // 5. 产业开拓全自动捕获
  for (const p of world.assets?.properties || []) {
    if (!p || !p.name) continue;
    if (p.name.includes('酒楼')) {
      addIfAbsent(
        '运河码头大酒楼',
        '【全资盘下运河码头大酒楼并盛大开张】：相公斥资510两白银全款拿下运河码头三层临街大酒楼，契纸红押全部办妥，由大娘子沈婉儿亲自主理开业、大掌柜周有财操持，后厨名厨大厨齐备，早已盛大开张营业、日进斗金，定位为两淮水运第一站与天下消息情报第一总中枢。'
      );
    } else if (p.name.includes('船队') || p.name.includes('大货船')) {
      addIfAbsent(
        '运河大货船队',
        '【置办运河大货船队开辟水运商路】：相公斥资数百两置办运河双桅大货船与吃水驳船共四艘组建王家船队，招募老练水手船工，开辟临江至扬州水运货运航道，为天下两淮茶盐客商承揽押运并稳赚水脚银。'
      );
    } else if (p.name.includes('鑫雅阁')) {
      addIfAbsent(
        '鑫雅阁',
        '【置办鑫雅阁与笼络官场】：相公出资三百两交由侧室崔婉宁筹备置办临江·鑫雅阁，知县周文达亲临验看并盖县衙关防公文为证；周知县举荐精通钱谷律令的钱书办任鑫雅阁大掌柜，正式将鑫雅阁打造为织就临江消息网、笼络各路达官显贵的清雅会所。'
      );
    }
  }

  // 6. 持久化同步到 data/world/milestones.json
  if (dataDir && typeof dataDir === 'string') {
    try {
      const msFile = path.join(dataDir, 'world', 'milestones.json');
      if (fs.existsSync(msFile)) {
        const raw = JSON.parse(fs.readFileSync(msFile, 'utf8'));
        raw.completedMilestones = Array.isArray(raw.completedMilestones) ? raw.completedMilestones : [];
        for (const item of world.milestones) {
          if (!raw.completedMilestones.includes(item)) {
            raw.completedMilestones.unshift(item);
          }
        }
        fs.writeFileSync(msFile, JSON.stringify(raw, null, 2), 'utf8');
      }
    } catch (e) {
      console.warn('[AutoChronicle] 同步持久化 milestones.json 异常：', e.message);
    }
  }

  return added;
}

