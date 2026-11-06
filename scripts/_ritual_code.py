import io
p = 'src/world/ritual.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """export function detectRitual(text) {
  const res = evaluateBedIntent(text);
  return { unlock: res.inBed, finish: res.shouldEnd };
}"""
new = """/**
 * 暗号只有一组：12345。
 * 第一次对出 → 解禁；解禁状态下再对一次 → 事毕归位。
 * 不再用任何"床笫词表"去猜——猜出来的都是误触。
 */
export function detectRitual(text) {
  const has = String(text || '').includes('12345');
  if (!has) return { unlock: false, finish: false };
  return { unlock: true, finish: false };
}"""
if old in s:
    s = s.replace(old, new, 1)
    # 在 prepareRitual 里做"再对一次即事毕"的切换
    old2 = """  const target = world.actors[actorId];
  target.intimacy = target.intimacy || { level: 0, tone: 0, lastAt: 0, ritual: 'solemn' };

  if (hit.unlock) {"""
    new2 = """  const target = world.actors[actorId];
  target.intimacy = target.intimacy || { level: 0, tone: 0, lastAt: 0, ritual: 'solemn' };

  // 已经解禁的人，再对一次 12345 就是"事毕"
  if (hit.unlock && target.intimacy.ritual === 'unlocked') {
    target.intimacy.ritual = 'solemn';
    target.intimacy.tone = target.intimacy.level >= 2 ? 1 : 0;
    saveState(dataDir, world);
    return { unlock: false, finish: true, actorId, tone: target.intimacy.tone, ritual: 'solemn' };
  }

  if (hit.unlock) {"""
    if old2 in s:
        s = s.replace(old2, new2, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('暗号只留 12345')
