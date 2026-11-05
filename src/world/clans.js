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

const SURNAMES = ['沈', '林', '王', '陆', '杨', '周', '吴', '陈', '刘', '赵', '钱', '孙'];

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
    if (ids.length < 2) continue;
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

  for (const clan of Object.values(world.clans)) {
    if (!clan) continue;
    // 名声好，宗族亲；名声坏，宗族远
    const drift = fame >= 30 ? 3 : fame <= -30 ? -4 : 1;
    clan.relation = Math.max(0, Math.min(100, num(clan.relation) + drift));

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
