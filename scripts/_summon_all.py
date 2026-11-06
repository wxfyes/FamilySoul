import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    // 8.7848 叫人来：话里点名"让/叫/请 某人 来"，引擎把人挪到跟前
    try {
      const mCall = /(?:让|叫|请|唤)\\s*([\\u4e00-\\u9fa5]{2,4})\\s*(?:来|到|过来|上前)/.exec(String(sayText || ''));"""
new = """    // 8.7848 叫人来：点名叫人，或"你们都来"把本宅内眷都请来
    try {
      const sayC = String(sayText || '');
      if (/(都|你们|大伙|全)[^。]{0,8}(来|过来|到.{0,4}(我|这)|回来)/.test(sayC)) {
        const wAll = loadState(this.dataDir);
        const meAll = wAll.actors?.[this._viewerActorId || 'husband'] || wAll.actors?.husband;
        const hereName = String(wAll.places?.[meAll?.location]?.name || '');
        const estate = hereName.includes('·') ? hereName.split('·').slice(0, 2).join('·') : '';
        const names = [];
        for (const a of Object.values(wAll.actors || {})) {
          if (!a || a.dead || a.id === meAll.id) continue;
          const kin = String(a.spouse || '') === 'husband' || /正妻|如夫人|二房|侧室|妾|通房|丫鬟|婆子|嬷嬷/.test(String(a.role || ''));
          if (!kin || a.location === meAll.location) continue;
          const homeName = String(wAll.places?.[a.home]?.name || '');
          if (!estate || !homeName.startsWith(estate)) continue;
          const mv = moveActor(wAll, a.id, meAll.location, 'world', '都叫到跟前');
          if (mv?.ok) names.push(a.name);
        }
        if (names.length) {
          saveState(this.dataDir, wAll);
          reply += `\\n（${names.join('、')}都应声到跟前来了。）`;
          console.log(`[Summon] 都叫来：${names.join('、')}`);
        }
      }
      const mCall = /(?:让|叫|请|唤)\\s*([\\u4e00-\\u9fa5]{2,4})\\s*(?:来|到|过来|上前)/.exec(String(sayText || ''));"""
if old in s and '都叫到跟前' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('都叫来')
