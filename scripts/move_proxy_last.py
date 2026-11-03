import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

start_marker = "    // 相公号：点了在场的人，模型没写出来 → 单独代演一句（和她的号同等待遇）"
start = s.find(start_marker)
if start < 0:
    print('WARN: block not found')
else:
    end_marker = "    // 全场收口：一句问话里点了谁，就只留谁的话；旁人（含婉儿）的段落掐掉"
    end = s.find(end_marker, start)
    if end < 0:
        print('WARN: end marker not found')
    else:
        block = s[start:end]
        s = s[:start] + s[end:]
        # 放到 saveHistory 之前（最后一道）
        anchor = "    this.saveHistory(profileKey, history);"
        idx = s.rfind(anchor)
        if idx < 0:
            print('WARN: saveHistory not found')
        else:
            s = s[:idx] + block + s[idx:]
            print('moved proxy fallback to the end')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
