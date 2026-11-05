import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          const atGate = /大门|门房|门厅|仪门|轿厅/.test(String(hereK?.name || '')) || hereK?.use === 'gate';"""
new = """          // 是不是站在大门：看结构（门房那一间 / 外院层级），不靠名字里有没有"大门"两个字
          const parentK = hereK?.parent ? wK.places?.[hereK.parent] : null;
          const atGate = Boolean(hereK) && (
            hereK.use === 'gate'
            || parentK?.rooms?.gate?.id === hereK.id
            || hereK.access === 'public_outer'
          );"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 门禁判定改看结构')

p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """        const isGate = /大门|门房|门厅|仪门|轿厅/.test(String(hereV?.name || '')) || hereV?.use === 'gate';"""
new2 = """        const parentV = hereV?.parent ? wV.places?.[hereV.parent] : null;
        const isGate = Boolean(hereV) && (
          hereV.use === 'gate'
          || parentV?.rooms?.gate?.id === hereV.id
          || hereV.access === 'public_outer'
        );"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② pet-service 同样改结构判定')
