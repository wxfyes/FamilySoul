import fs from 'fs';
const s = fs.readFileSync('web/dashboard.html', 'utf8');
const p1 = s.indexOf('id="tab-overview"');
const p2 = s.indexOf('id="tab-travel"');
console.log('tab-overview start:', p1, 'tab-travel start:', p2);
console.log('Overview snippet:\n', s.slice(p1 - 20, p1 + 400));
