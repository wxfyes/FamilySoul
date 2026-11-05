import io
p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find('export function applyNpcDeparture(')
nxt = s.find('\nexport function ', start + 10)
if start < 0 or nxt < 0:
    raise SystemExit('locate failed: start=%d next=%d' % (start, nxt))

new_fn = '''export function applyNpcDeparture(dataDir, replyText, sayText = '') {
  const text = String(replyText || '');
  if (!text) return [];

  // 只有天道明确写了 [[depart:谁|去哪儿]] 才动身。
  // 台词里出现"退下""这就去"这类词，一律只当台词，不再由正则偷听触发位移。
  const tags = [...text.matchAll(/\\[\\[depart:\\s*([^|\\]]+?)\\s*\\|\\s*([^\\]]+?)\\s*\\]\\]/g)];
  if (!tags.length) return [];

  const world = loadState(dataDir);
  const left = [];

  for (const m of tags) {
    const name = String(m[1] || '').trim();
    const hint = String(m[2] || '').trim();
    const actor = matchActor(world.actors, name);
    if (!actor) continue;

    const from = actor.location;
    const dest = resolvePlaceTarget(world, hint, { nearId: from, actor });
    if (!dest || dest === from) continue;

    const moved = moveActor(world, actor.id, dest, 'world', `离场：${hint.slice(0, 10)}`);
    if (!moved?.ok) {
      console.warn(`[Departure] ${actor.name} 没能去「${hint}」：${moved?.error || '无去处'}`);
      continue;
    }

    actor.activity = {
      text: `去了${world.places?.[dest]?.name || '别处'}`,
      at: world.clock?.hour || 0,
      day: world.clock?.day || 1,
    };
    if (isOuting(world, from, dest)) {
      actor.away = { place: dest, untilDay: (Number(world.clock?.day) || 1) + 1, hint };
    } else {
      delete actor.away;
    }
    left.push(actor.name);
    console.log(`[Departure] ${actor.name}(${actor.id}) → ${world.places?.[dest]?.name || dest}`);
  }

  if (left.length > 0) saveState(dataDir, world);
  return left;
}
'''
s = s[:start] + new_fn + s[nxt+1:]
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('rewritten')
