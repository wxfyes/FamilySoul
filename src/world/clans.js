/**
 * 宗族与商帮：一个人不是孤立的。
 *
 * 宗族 = 同姓的人 + 一份共同的脸面。
 * 它不替你打仗，但它会：
 *   · 每月走动一次（关系、人情）
 *   · 族里有人出事，会来求你
 *   · 你名声好，宗族帮你撑腰；你名声坏，宗族先跟你划清界限
 */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// 常见汉姓（不再写死 12 个，避免"李张"永远成不了族）
const SURNAMES = (
  '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜'
  + '戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐'
  + '费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄'
  + '和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁'
  + '杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍'
  + '虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚'
  + '程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓'
  + '牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙'
  + '叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻'
  + '莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温'
  + '别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡'
  + '国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾'
  + '毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公'
).split('');

/** 与王家真有走动的那几族：本宗、姻亲、商帮 */
export function relatedClanIds(world) {
  const related = new Set();
  const me = world.actors?.husband;
  const mySurname = String(me?.name || '').slice(0, 1);
  if (mySurname) related.add(`clan_${mySurname}`);
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead) continue;
    // 亲眷只认：府内人、配偶是相公、或相公的亲生子女（不能把"认识相公"算亲戚）
    const isKin = a.household || a.spouse === 'husband' || (Array.isArray(a.parents) && a.parents.includes('husband'));
    if (!isKin) continue;
    const s2 = String(a.name || '').slice(0, 1);
    if (s2) related.add(`clan_${s2}`);
  }
  if (world.clans?.bang) related.add('bang');
  return related;
}

export function ensureClans(world) {
  world.clans = world.clans && typeof world.clans === 'object' ? world.clans : {};

  // 按姓氏聚族：至少两人同姓，才算一族
  const bySurname = {};
  for (const a of Object.values(world.actors || {})) {
    if (!a || a.dead || !a.name) continue;
    const s = String(a.name).slice(0, 1);
    if (!SURNAMES.includes(s)) continue;
    bySurname[s] = bySurname[s] || [];
    bySurname[s].push(a.id);
  }

  for (const [surname, ids] of Object.entries(bySurname)) {
    const id = `clan_${surname}`;
    if (world.clans[id]) {
      world.clans[id].members = ids;
      continue;
    }
    // 有两人才算一族；只有一人、但此人是王家亲眷（妻妾/血亲），也算他娘家那一族
    if (ids.length < 2) {
      const solo = world.actors?.[ids[0]];
      const kin = solo && (solo.id === 'husband' || solo.household || solo.spouse === 'husband' || solo.relations?.husband);
      if (!kin) continue;
    }
    world.clans[id] = {
      id,
      name: `${surname}氏宗族`,
      surname,
      members: ids,
      relation: 50,
      influence: Math.min(90, 30 + ids.length * 8),
      createdDay: world.clock?.day || 1,
    };
  }

  // 商帮：跨姓的利益共同体（谁的产业多，谁就自然成帮）
  const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
  if (props.length >= 3 && !world.clans.bang) {
    world.clans.bang = {
      id: 'bang',
      name: '临江商帮',
      surname: null,
      members: [],
      relation: 55,
      influence: Math.min(90, 30 + props.length * 6),
      createdDay: world.clock?.day || 1,
    };
  }
  return world.clans;
}

/** 每月初一：宗族走动（关系涨落 + 偶尔求助） */
export function runClanVisits(world, events, nextEvent) {
  const day = Number(world.clock?.day) || 1;
  if (day % 30 !== 0) return;
  ensureClans(world);
  const me = world.actors?.husband;
  const fame = num(me?.fame?.value);

  const related = relatedClanIds(world);

  for (const clan of Object.values(world.clans)) {
    if (!clan) continue;
    // 名声好，宗族亲；名声坏，宗族远（外姓宗族不因你名声而动）
    const isKin = related.has(clan.id);
    const drift = isKin ? (fame >= 30 ? 3 : fame <= -30 ? -4 : 1) : 0;
    clan.relation = Math.max(0, Math.min(100, num(clan.relation) + drift));

    // 只有本宗/姻亲/商帮才会登门；外姓宗族各自族内走动，不来王家
    if (!isKin) continue;
    if (clan.relation >= 60 && Math.random() < 0.5) {
      events.push(nextEvent(world, {
        action: 'clan_visit', actor: me?.id || 'husband', place: null,
        payload: { text: `${clan.name}的族老登门走动，话里话外想求你提携族中后辈` },
        isPublic: false,
      }));
    } else if (clan.relation <= 25 && Math.random() < 0.4) {
      events.push(nextEvent(world, {
        action: 'clan_cold', actor: me?.id || 'husband', place: null,
        payload: { text: `${clan.name}与你渐行渐远，市井上传出些不好听的话` },
        isPublic: true,
      }));
    }
  }
}

/** 宗族给你撑腰：名声 + 一次小助力（由外部按需调用） */
export function clanBacking(world, actorId) {
  ensureClans(world);
  const surname = String(world.actors?.[actorId]?.name || '').slice(0, 1);
  const clan = world.clans[`clan_${surname}`];
  if (!clan) return { ok: false, error: '你背后没有宗族' };
  if (num(clan.relation) < 50) return { ok: false, error: `${clan.name}不愿为你出头` };
  return { ok: true, clan, influence: clan.influence };
}
