import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        else if (act === 'transfer') result = transferPropertyGrain(world, fid, String(body.prop || ''), String(body.city || ''), Number(body.shi) || 0);"
new = """        else if (act === 'transfer') result = transferPropertyGrain(world, fid, String(body.prop || ''), String(body.city || ''), Number(body.shi) || 0);
        else if (act === 'gear') result = buyGear(world, fid, String(body.kind || 'weapon'), Number(body.qty) || 0);"""
if old in s and "act === 'gear'" not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('补 gear 动作')
