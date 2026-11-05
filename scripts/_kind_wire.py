import io
# server 兵权接口：recruit 带 kind
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        if (act === 'recruit') result = recruit(world, fid, Number(body.count) || 0, String(body.city || ''));"
new = "        if (act === 'recruit') result = recruit(world, fid, Number(body.count) || 0, String(body.city || ''), String(body.kind || 'guard'));"
if old in s:
    s = s.replace(old, new, 1)
    print('① 接口透传 kind')

# 确认接口执行也带 kind
old2 = "          const rMil = pend.action === 'gear'\n            ? buyGear(world, 'wangjia', String(pend.gearKind || 'weapon'), Number(pend.qty) || 0)\n            : recruit(world, 'wangjia', Number(pend.qty) || 0, String(pend.city || ''));"
new2 = "          const rMil = pend.action === 'gear'\n            ? buyGear(world, 'wangjia', String(pend.gearKind || 'weapon'), Number(pend.qty) || 0)\n            : recruit(world, 'wangjia', Number(pend.qty) || 0, String(pend.city || ''), String(pend.recruitKind || 'guard'));"
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 确认单带 kind')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# pet-service：聊天标签支持名目 [[recruit:家丁|20]]
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
old3 = """        const body3 = String(milTag[1] || '').split('|').map((x) => x.trim());
        const count = Math.max(1, Math.min(500, Math.round(Number(body3[0]) || 0) || 10));"""
new3 = """        const body3 = String(milTag[1] || '').split('|').map((x) => x.trim());
        const kindMap = { 家丁: 'guard', 护院: 'retainer', 营兵: 'army', 兵: 'guard' };
        let recruitKind = 'guard';
        let countRaw = body3[0];
        if (kindMap[body3[0]]) { recruitKind = kindMap[body3[0]]; countRaw = body3[1]; }
        const count = Math.max(1, Math.min(500, Math.round(Number(countRaw) || 0) || 10));"""
if old3 in t:
    t = t.replace(old3, new3, 1)
    t = t.replace("          action: 'recruit',\n          qty: count,", "          action: 'recruit',\n          recruitKind,\n          qty: count,")
    print('③ 聊天标签支持家丁/护院')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
