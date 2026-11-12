import { findTargetActorInText } from './naming.js';

/** 计算在场人物的古代主从尊卑与长幼权重（尊者/主事人优先回话） */
export function actorSeniority(a) {
  if (!a) return 0;
  const role = String(a.role || '');
  const title = String(a.title || '');
  const name = String(a.name || '');
  // 1. 正妻最高
  if (/正妻|发妻|大娘子/.test(role) || a.id === 'waner') return 1000;
  // 2. 侧室如夫人/二房
  if (/如夫人|二房|侧室|妾/.test(role) || a.id === 'yunnia') return 900;
  // 2.5 官宦名门千金、朝廷官员、诰命夫人（如知府千金杨采儿、知县周文达、知府杨振华等，绝非下人跟班！）
  if (/千金|大小姐|闺秀|知府|县令|知县|知州|巡抚|尚书|大人|太守|通判|县丞|主簿|夫人|员外|老爷|山长/.test(role)
      || /千金|大小姐|大人|知府|知县/.test(title)) {
    return 880 + (Number(a.age) || 20);
  }
  // 3. 其他内眷/侍妾
  if (/通房|姨娘/.test(role) || a.id === 'wanning') return 800;
  // 3.2 商界老板娘、东家、青楼花魁、头牌、红颜正主（如柳如烟、紫嫣、苏映雪等）
  if (/老板娘|东家|楼主|花魁|头牌|班主|坊主|掌院|先生|娘子/.test(role) || /老板娘|花魁/.test(title)) {
    return 680 + (Number(a.age) || 22);
  }
  // 3.5 客人/乡绅/客商只是客人，不能凭“叔/伯”压过掌柜账房，也不能代报产业内部账
  if (/乡绅|客商|公子|富商|茶客|酒客|顾客|客人|买主|贵客/.test(role)) {
    return 100 + (Number(a.age) || 20);
  }
  // 4. 掌柜/总管/管事/头领/典吏（或尊称叔、伯的长者）
  if (/掌柜|管事|头领|领头|头目|总管|教头|典吏|书吏|捕头/.test(role) || /掌柜|管事|领头/.test(title) || /叔|伯|老/.test(name)) {
    return 600 + (Number(a.age) || 30);
  }
  // 5. 贴身大丫鬟
  if (/贴身|大丫鬟/.test(role) || a.id === 'xiaocui') return 500;
  // 5.5 大厨/厨子
  if (/厨子|大厨|主厨/.test(role) || /厨/.test(title)) return 450 + (Number(a.age) || 30);
  // 6. 普通护院/家丁（长者为尊）
  if (/护院/.test(role)) return 400 + (Number(a.age) || 20);
  if (/家丁|门房/.test(role)) return 300 + (Number(a.age) || 20);
  if (/丫鬟|婢女/.test(role)) return 200 + (Number(a.age) || 16);
  if (/伙计|跑堂|小二/.test(role)) return 150 + (Number(a.age) || 18);
  return 100 + (Number(a.age) || 20);
}

/**
 * 这一轮该谁说话：唯一的发言权判定处。
 * 优先级：相公指名呼唤在场者 > 呼唤领头人/管事 > 现场唯一在场活人 > 上次对话且仍在场的非随从对象 > 场景位尊领头正主。
 */
export function resolveTurnTarget({ world, viewerId = 'husband', say = '', present = [] }) {
  const said = String(say || '');
  const actors = world?.actors || {};
  const here = (present || []).filter((a) => a && !a.dead && a.id !== viewerId);

  // ⓪ 点王甯的名：不管他在哪都应声
  const hus = actors.husband;
  if (hus && /(王甯|王掌柜|少掌柜)/.test(said) && viewerId !== 'husband') {
    return { kind: 'husband', actor: hus, actorId: 'husband', named: true };
  }

  // ① 相公明确指定"领头的/管事的/头儿/谁领头"回话
  if (/(领头的|头儿|头头|管事|掌事|主事|头目|谁领头|领头人|领头)/.test(said) && here.length > 0) {
    const leader = [...here].sort((x, y) => actorSeniority(y) - actorSeniority(x))[0];
    if (leader) {
      return { kind: 'npc', actor: leader, actorId: leader.id, named: true };
    }
  }

  // ② 相公指名道姓/古风称呼呼唤（优先在当前在场者 here 中匹配，彻底防止同名/同字根的场外人干扰！）
  const namedHere = findTargetActorInText(here, said);
  if (namedHere) {
    return { kind: namedHere.id === 'husband' ? 'husband' : 'npc', actor: namedHere, actorId: namedHere.id, named: true };
  }
  const namedGlobal = findTargetActorInText(actors, said);
  if (namedGlobal) {
    const isHere = here.some((a) => a.id === namedGlobal.id);
    if (isHere) {
      return { kind: namedGlobal.id === 'husband' ? 'husband' : 'npc', actor: namedGlobal, actorId: namedGlobal.id, named: true };
    }
  }

  // ③ 现场唯一直属在场者：除相公外只有1人在场，唯一正主就是她/他！
  if (here.length === 1) {
    return { kind: 'npc', actor: here[0], actorId: here[0].id, named: false, solePresent: true };
  }

  // ④ 上次聊的是谁（且这个人在场且未离场）
  const partnerId = String((world?.chatPartners || {})[viewerId] || '');
  const partner = partnerId ? actors[partnerId] : null;
  const partnerHere = partner && !partner.dead && here.some((a) => a.id === partnerId);
  if (partnerHere) {
    // 礼法不变量：只有真正的下人随从（<500）才不得越过在场主事人长久霸占麦克风；
    // 若 partner 是知府千金、名门闺秀、老板娘、官员或妻妾（>=500），即使沈婉儿同场，也保持当前对话对象的连续发言权！
    const leader = [...here].sort((x, y) => actorSeniority(y) - actorSeniority(x))[0];
    const partnerIsSubordinate = actorSeniority(partner) < 500 && actorSeniority(leader) >= 600;
    if (!partnerIsSubordinate) {
      return { kind: partnerId === 'husband' ? 'husband' : 'npc', actor: partner, actorId: partnerId, named: false };
    }
  }

  // ⑤ 默认按古代尊卑长幼位次：永远由在场位尊者、领头人优先主答（绝不让小跟班抢白）
  if (here.length > 0) {
    const sorted = [...here].sort((x, y) => actorSeniority(y) - actorSeniority(x));
    const prime = sorted[0];
    return { kind: 'npc', actor: prime, actorId: prime.id, named: false };
  }

  return { kind: 'none', actor: null, actorId: null, named: false };
}

/** 记下这一轮的对话对象 */
export function rememberPartner(world, viewerId, actorId) {
  world.chatPartners = world.chatPartners || {};
  if (actorId) world.chatPartners[viewerId] = actorId;
  return world;
}
