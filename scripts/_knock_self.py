import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const wV = loadState(this.dataDir);
        const meV = this._viewerActorId ? wV.actors?.[this._viewerActorId] : wV.actors?.husband;"""
new = """        const wV = loadState(this.dataDir);
        const meV = wV.actors?.[selfId] || (this._viewerActorId ? wV.actors?.[this._viewerActorId] : wV.actors?.husband);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 叩门用 selfId 取本人')
