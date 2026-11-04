import io, re

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
changed = []

# ① 把"大导演转场引擎"那一整段换成一句事实
start = s.find('contextHint = `（【天道大导演实时空间转场引擎')
if start >= 0:
    end = s.find('）`;', start)
    if end >= 0:
        end += len('）`;')
        fact = """contextHint = (() => {
          const wT = loadState(this.dataDir);
          const meT = this._viewerActorId ? wT.actors?.[this._viewerActorId] : wT.actors?.husband;
          const placeT = String(wT.places?.[meT?.location]?.name || '');
          const hereT = Object.values(wT.actors || {})
            .filter((a) => a && !a.dead && a.name && a.location === meT?.location && a.id !== (meT?.id || 'husband'))
            .slice(0, 4).map((a) => a.name);
          return `（【现状】相公此刻在「${placeT}」。${hereT.length ? '此处：' + hereT.join('、') + '。' : '此处无人。'}）\\n`;
        })();"""
        s = s[:start] + fact + s[end:]
        changed.append('转场大导演指令 → 一句事实')

# ② 把"晨间邸报"里写死的三个角色台词删掉，只留一条真实风闻
start2 = s.find('contextHint = `（【每日晨间江湖邸报与市井新气象】')
if start2 >= 0:
    end2 = s.find('）`;', start2)
    if end2 >= 0:
        end2 += len('）`;')
        fact2 = """contextHint = (() => {
          const wM2 = loadState(this.dataDir);
          const rumor = (wM2.rumors || []).slice(-1)[0];
          const rumorText = rumor?.text ? String(rumor.text).slice(0, 40) : (wM2.rumors?.length ? '' : '');
          return `（【现状】第${wM2.clock?.day}日 ${wM2.clock?.hour}时。${rumorText ? '城里在传：' + rumorText + '。' : ''}该起身了。）\\n`;
        })();"""
        s = s[:start2] + fact2 + s[end2:]
        changed.append('晨间邸报台词 → 真实风闻一句')

io.open(p, 'w', encoding='utf-8').write(s)
print('改动:', '、'.join(changed) if changed else '无')
