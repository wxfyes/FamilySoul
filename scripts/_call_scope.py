import io
p = 'src/world/chat-actions.js'
s = io.open(p, encoding='utf-8-sig').read()
# 叫人来：只叫本宅内眷；有护院字样时不叫内眷；最多 8 个
old = """  const callAll = /(都|你们|大伙|全)[^。]{0,8}(来|过来|到.{0,4}(我|这)|回来)/.test(say);
  const mCall = /(?:让|叫|请|唤)\\s*([\\u4e00-\\u9fa5]{2,4})\\s*(?:来|到|过来|上前)/.exec(say);
  if (callAll || mCall) {
    const targets = callAll
      ? Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== me.id && isKin(a))
      : [findByName(world, mCall?.[1])].filter(Boolean);"""
new = """  const staffWords = /护院|家丁|当差|当值|门房/.test(say);
  const callAll = !staffWords && /(都|你们|大伙|全)[^。]{0,8}(来|过来|到.{0,4}(我|这)|回来)/.test(say);
  const mCall = /(?:让|叫|请|唤)\\s*([\\u4e00-\\u9fa5]{2,4})\\s*(?:来|到|过来|上前)/.exec(say);
  if (callAll || mCall) {
    const hereName0 = String(world.places?.[me.location]?.name || '');
    const estate0 = hereName0.includes('·') ? hereName0.split('·').slice(0, 2).join('·') : '';
    const isMyKin = (a) => (String(a.spouse || '') === 'husband' && /正妻|如夫人|二房|侧室|妾|通房|丫鬟/.test(String(a.role || '')))
      || (estate0 && String(world.places?.[a.home]?.name || '').startsWith(estate0)
        && /正妻|如夫人|二房|侧室|妾|通房|丫鬟/.test(String(a.role || '')));
    const targets = callAll
      ? Object.values(world.actors || {}).filter((a) => a && !a.dead && a.id !== me.id && isMyKin(a)).slice(0, 8)
      : [findByName(world, mCall?.[1])].filter(Boolean);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('叫人来收口')
