import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        if (/天道|旁白|众人/.test(spk) || spk === (me?.name || '')) { kept.push(seg); continue; }"
new = """        // 系统/差事类标头不是人（如「领受差事 · 林芸娘」），原样留着
        if (/[·・]/.test(spk) || /天道|旁白|众人|差事|任务|系统|回执|结算/.test(spk) || spk === (me?.name || '')) {
          kept.push(seg);
          continue;
        }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 差事/系统标头不再当人')
