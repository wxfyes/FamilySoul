const fs = require('fs');
let code = fs.readFileSync('src/pet-service.js', 'utf8');

// 1. enrich presentNamesNow with short names
const target1 = 'const replyHasPresentSpeaker = !replyIsNarration && presentNamesNow.some((n) => String(reply || \'\').includes(n));';
const replace1 = `const replyHasPresentSpeaker = !replyIsNarration && (
            presentNamesNow.some((n) => String(reply || '').includes(n) || String(reply || '').includes(n.length > 2 ? n.slice(-2) : n))
            || /【[^】\\n]{1,12}】/.test(reply)
          );`;

if (code.includes(target1)) {
  code = code.replace(target1, replace1);
  console.log('Target 1 replaced');
}

// 2. already check
const target2 = `const already = String(reply).includes(npc.name)
              || new RegExp(\`【[^】]*\${String(npc.name).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')}\`).test(String(reply));`;

const replace2 = `const shortName = npc.name.length > 2 ? npc.name.slice(-2) : npc.name;
            const already = String(reply).includes(npc.name)
              || String(reply).includes(shortName)
              || new RegExp(\`【[^】]*\${String(shortName).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')}\`).test(String(reply))
              || (/【[^】\\n]{1,12}】/.test(reply) && !replyIsNarration);`;

if (code.includes(target2)) {
  code = code.replace(target2, replace2);
  console.log('Target 2 replaced (LF)');
} else if (code.includes(target2.replace(/\n/g, '\r\n'))) {
  code = code.replace(target2.replace(/\n/g, '\r\n'), replace2.replace(/\n/g, '\r\n'));
  console.log('Target 2 replaced (CRLF)');
} else {
  console.warn('Target 2 NOT found, trying regex');
  code = code.replace(
    /const already = String\(reply\)\.includes\(npc\.name\)[\s\S]*?\.test\(String\(reply\)\);/,
    replace2
  );
  console.log('Target 2 replaced via regex');
}

fs.writeFileSync('src/pet-service.js', code, 'utf8');
console.log('Finished updating pet-service.js');

