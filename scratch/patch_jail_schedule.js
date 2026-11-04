import fs from 'node:fs';

// 1. src/world/position.js
let pos = fs.readFileSync('src/world/position.js', 'utf8').replace(/\r\n/g, '\n');
pos = pos.replace(
  "if (a.jailed && !/(jail|牢|大牢)/.test(placeId) && note !== '刑满释放' && reason !== 'admin')",
  "if (a.jailed && !/(jail|牢|大牢)/.test(placeId) && !String(note || '').startsWith('刑满') && reason !== 'admin')"
);
fs.writeFileSync('src/world/position.js', pos, 'utf8');
console.log('position.js patched!');

// 2. src/world/apply.js
let apply = fs.readFileSync('src/world/apply.js', 'utf8').replace(/\r\n/g, '\n');
apply = apply.replace(
  "if (pA && !pA.dead && pA.location !== oldLoc && pA.location !== finalTargetId)",
  "if (pA && !pA.dead && !pA.jailed && pA.location !== oldLoc && pA.location !== finalTargetId)"
);
fs.writeFileSync('src/world/apply.js', apply, 'utf8');
console.log('apply.js patched!');

// 3. src/world/clock.js
let clk = fs.readFileSync('src/world/clock.js', 'utf8').replace(/\r\n/g, '\n');

// 刑满释放循环处守护
const clkJailTarget = `    if (day >= Number(a.jailed.untilDay || 0)) {
      moveActor(world, a.id, a.home || 'street', 'world', '刑满');
      delete a.jailed;
      events.push(nextEvent(world, { action: 'released', actor: a.id, place: a.location, payload: { text: \`\${a.name}刑满出狱\` }, isPublic: true }));
    }`;

const clkJailReplace = `    if (day >= Number(a.jailed.untilDay || 0)) {
      delete a.jailed;
      moveActor(world, a.id, a.home || 'street', 'world', '刑满释放');
      a.activity = { text: '重获自由', at: world.clock?.hour || 0, day };
      events.push(nextEvent(world, { action: 'released', actor: a.id, place: a.location, payload: { text: \`\${a.name}刑满出狱\` }, isPublic: true }));
    } else {
      if (!/(jail|牢|大牢)/.test(String(a.location || ''))) {
        const jailLoc = a.gender === 'female' ? 'jail_female' : 'jail_male';
        if (world.places?.[jailLoc]) {
          a.location = jailLoc;
        }
      }
      a.activity = { text: '大牢服刑', at: world.clock?.hour || 0, day };
      if (Array.isArray(world.party?.husband)) {
        world.party.husband = world.party.husband.filter((pid) => pid !== a.id);
      }
    }`;

if (!clk.includes(clkJailTarget)) {
  console.error('clkJailTarget not found!');
  process.exit(1);
}
clk = clk.replace(clkJailTarget, clkJailReplace);

// runSchedules 处拦截在押人员作息
const clkSchedTarget = `      if (slot.at === world.clock.hour && slot.place) {
        actor.activity = { text: String(slot.do || ''), at: world.clock.hour, day: world.clock.day };
        if (actor.location === slot.place) continue;
        // 正在私会的人不打断；被相公派出去的人（外派豁免期内）也不拉回来；在押服刑者严禁外出走动作息
        if (actor.jailed) continue;`;

const clkSchedReplace = `      if (slot.at === world.clock.hour && slot.place) {
        if (actor.jailed) continue;
        actor.activity = { text: String(slot.do || ''), at: world.clock.hour, day: world.clock.day };
        if (actor.location === slot.place) continue;
        // 正在私会的人不打断；被相公派出去的人（外派豁免期内）也不拉回来；在押服刑者严禁外出走动作息
        if (actor.intimacy?.ritual === 'unlocked') continue;`;

if (!clk.includes(clkSchedTarget)) {
  console.error('clkSchedTarget not found!');
  process.exit(1);
}
clk = clk.replace(clkSchedTarget, clkSchedReplace);

fs.writeFileSync('src/world/clock.js', clk, 'utf8');
console.log('clock.js patched!');
