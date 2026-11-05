import fs from 'fs';

let html = fs.readFileSync('web/dashboard.html', 'utf8');

function findOccurrences(str, target) {
  let idx = 0;
  const res = [];
  while ((idx = str.indexOf(target, idx)) !== -1) {
    res.push(idx);
    idx += target.length;
  }
  return res;
}

console.log("filterActors:", findOccurrences(html, "function filterActors("));
console.log("card-accounts:", findOccurrences(html, "if ($('card-accounts')) {"));
console.log("actors rendering:", findOccurrences(html, "$('actors').innerHTML ="));
