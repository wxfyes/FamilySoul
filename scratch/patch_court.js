import fs from 'node:fs';

let code = fs.readFileSync('src/server.js', 'utf8');

const target1 = `        if (jailDays > 0 && culprit && culprit.id !== 'husband') {
          culprit.jailed = { untilDay: (Number(w3.clock?.day) || 1) + jailDays, caseId: cc.id };
          const cityName = String(cc.city || '');
          if (cityName && cityName !== '临江府') {
            const jailName = \`\${cityName}·大牢\`;
            let jp = Object.keys(w3.places || {}).find((k) => w3.places[k]?.name === jailName);
            if (!jp) {
              w3.flags.placeSeq = (Number(w3.flags.placeSeq) || 0) + 1;
              jp = \`place_\${w3.flags.placeSeq}\`;
              w3.places[jp] = { name: jailName, exits: ['street'], owner: 'court', dynamic: true, city: cityName };
            }
            moveActor(world, culprit.id, jp, 'world', '收监');
          } else {
            moveActor(world, culprit.id, culprit.gender === 'male' ? 'jail_male' : 'jail_female', 'world', '收监');
          }
        }`;

const replacement1 = `        if (jailDays > 0 && culprit && culprit.id !== 'husband') {
          culprit.jailed = { untilDay: (Number(w3.clock?.day) || 1) + jailDays, caseId: cc.id };
          culprit.activity = { text: '大牢服刑', day: w3.clock?.day || 1, hour: w3.clock?.hour || 0 };
          if (Array.isArray(w3.party?.husband)) {
            w3.party.husband = w3.party.husband.filter((pid) => pid !== culprit.id);
          }
          const cityName = String(cc.city || '');
          if (cityName && cityName !== '临江府') {
            const jailName = \`\${cityName}·大牢\`;
            let jp = Object.keys(w3.places || {}).find((k) => w3.places[k]?.name === jailName);
            if (!jp) {
              w3.flags.placeSeq = (Number(w3.flags.placeSeq) || 0) + 1;
              jp = \`place_\${w3.flags.placeSeq}\`;
              w3.places[jp] = { name: jailName, exits: ['street'], owner: 'court', dynamic: true, city: cityName };
            }
            moveActor(w3, culprit.id, jp, 'world', '收监');
          } else {
            moveActor(w3, culprit.id, culprit.gender === 'male' ? 'jail_male' : 'jail_female', 'world', '收监');
          }
        }`;

const target2 = `if (a.location === 'yamen') moveActor(world, a.id, a.home || 'street', 'world', '下值回家');`;
const replacement2 = `if (a.location === 'yamen') moveActor(w3, a.id, a.home || 'street', 'world', '下值回家');`;

// 统一换行符进行比较
const normCode = code.replace(/\r\n/g, '\n');
const normTarget1 = target1.replace(/\r\n/g, '\n');

if (!normCode.includes(normTarget1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}

let patched = normCode.replace(normTarget1, replacement1.replace(/\r\n/g, '\n'));
patched = patched.replace(target2, replacement2);

fs.writeFileSync('src/server.js', patched, 'utf8');
console.log('Successfully patched src/server.js!');
