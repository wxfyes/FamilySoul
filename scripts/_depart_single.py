import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 删掉旧的 8.82 点名走人（和 8.9 重复，且会把家眷丢到街上）
start = s.find("    // 8.82 话里点到谁 + 让他走")
end = s.find("    // 8.83 相公点名让谁去某处", start)
if start > 0 and end > start:
    s = s[:start] + s[end:]
    print('① 删 8.82')

# ② 8.9：点名的人（不在跟前也算）回自己住处；没点名才清场
old = """        // 话里点了名的，只走被点名的；没点名才清场
        const named = Object.values(wF.actors || {}).filter((a) => a && !a.dead && a.name
          && a.location === meF?.location && String(sayText || '').includes(a.name));
        const goers0 = named.length ? named : hereF.slice();"""
new = """        // 话里点了名的：不管在不在跟前，都回自己的住处；没点名才清场
        const saidNow = String(sayText || '');
        const namedAll = Object.values(wF.actors || {}).filter((a) => {
          if (!a || a.dead || !a.name || a.id === meF?.id) return false;
          if (saidNow.includes(a.name)) return true;
          const short = a.name.length > 2 ? a.name.slice(-2) : '';
          return Boolean(short && saidNow.includes(short) && /回|退|走/.test(saidNow));
        });
        const goers0 = namedAll.length ? namedAll : hereF.slice();"""
if old in s:
    s = s.replace(old, new, 1)
    print('② 点名含不在场')
io.open(p, 'w', encoding='utf-8-sig').write(s)
