import io
# ① 相好不再由"信任高"单独决定：必须有实际的亲密（成事）或明确的相好关系
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const isIntimate = (a) => (a.intimacy && a.intimacy.consummated) || Number(rel(a).trust) >= 60;"""
new = """        // 相好 = 真有过肌肤之亲（或明写了相好关系）；光"信任高、合作多"只是常来往
        const isIntimate = (a) => Boolean(a.intimacy?.consummated)
          || String(a.bondsWithHusband || '') === '相好'
          || Number(a.relations?.husband?.intimate) === 1;"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 相好判定收紧')

# ② summarize 里"已是相好"也要看是否成事
p2 = 'src/world/summarize.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """    return '已是你的相好，只是脸皮薄，要你先把话递过去';"""
new2 = """    return '心里早已应了，只是没到那一步';"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('② 措辞改准')
