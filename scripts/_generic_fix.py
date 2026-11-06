import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const namedActors = Object.values(wEnd.actors || {}).filter((a) => {
        if (!a || a.dead || !a.name || a.id === this._viewerActorId) return false;
        const short = a.name.length > 2 ? a.name.slice(-2) : a.name;
        return sayText.includes(a.name) || (short && sayText.includes(short));
      });"""
new = """      // 只认全名或非通称尾名：别把“掌柜的呢”当成在喊某个姓张的掌柜
      const GENERIC = ['掌柜', '东家', '夫人', '娘子', '小姐', '公子', '老爷', '婆婆', '婶子', '公公', '伙计', '老板', '客官', '大娘子'];
      const namedActors = Object.values(wEnd.actors || {}).filter((a) => {
        if (!a || a.dead || !a.name || a.id === this._viewerActorId) return false;
        if (sayText.includes(a.name)) return true;
        const short = a.name.length > 2 ? a.name.slice(-2) : '';
        if (!short || GENERIC.includes(short)) return false;
        return sayText.includes(short);
      });"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('通称不算点名 ok')
else:
    print('未匹配')
