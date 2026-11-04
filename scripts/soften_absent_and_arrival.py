import io

p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

# ① 不再硬替换成旁白，只在"模型什么都没说"时才兜底
start = None
for i, l in enumerate(lines):
    if 'if (absent && !absentIsHousehold &&' in l:
        start = i
        break

if start is None:
    print('WARN: 不在场块没找到')
else:
    end = start
    for j in range(start, min(start + 12, len(lines))):
        if lines[j].strip() == '}':
            end = j
            break
    block = [
        "      if (absent && !absentIsHousehold && !String(reply || '').includes(String(wAbs.places?.[absent.location]?.name || ''))) {",
        "        const whereA = String(wAbs.places?.[absent.location]?.name || '别处');",
        "        const hereA = String(wAbs.places?.[meA2?.location]?.name || '这里');",
        "        // 先只把事实塞进提示，让天道用自己的话说；只有它一个字没写时才兜底",
        "        contextHint += `（【事实】${absent.name}此刻在「${whereA}」，不在这儿。若对方问起，就照实说，别装作他/她在场。）\\n`;",
        "        if (!String(reply || '').trim() || /^\\.{2,}$/.test(String(reply || '').trim())) {",
        "          reply = `【${hereA}】：${absent.name}在「${whereA}」，眼下不在这儿。`;",
        "        }",
        "        console.log(`[Scene] 点名不在场：${absent.name}@${whereA}（交给天道措辞）`);",
        "      }",
    ]
    lines = lines[:start] + block + lines[end + 1:]
    print('① 不在场不再硬替换成旁白')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))

# ② /api/world/go 返回"到达提示"整行
p2 = 'src/server.js'
s = io.open(p2, encoding='utf-8-sig').read()
old = """        const after = peek(DATA_DIR);
        const me = after.actors?.husband;
        return sendJson(res, 200, {
          ok: true, applied: Boolean(res2.applied),
          place: after.places?.[me?.location]?.name || me?.location || '',
        });"""
new = """        const after = peek(DATA_DIR);
        const me2 = after.actors?.[actorId] || after.actors?.husband;
        const placeName2 = after.places?.[me2?.location]?.name || me2?.location || '';
        const hereList = Object.values(after.actors || {})
          .filter((a) => a && !a.dead && a.name && a.location === me2?.location && a.id !== (me2?.id || 'husband'))
          .slice(0, 5)
          .map((a) => a.name + (a.activity?.text ? '在' + a.activity.text : ''));
        const line = `（你到了「${placeName2}」。${hereList.length ? '此处：' + hereList.join('，') + '。' : '此处无人。'}）`;
        return sendJson(res, 200, { ok: true, applied: Boolean(res2.applied), place: placeName2, line });"""
if old in s:
    s = s.replace(old, new, 1)
    print('② go 接口返回到达提示')
else:
    print('WARN: go 接口返回段没找到')
io.open(p2, 'w', encoding='utf-8').write(s)
print('done')
