import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 代演收尾处：如果是"刚回到/走到某处"，把生硬的没人应声换成到场旁白
old = "          } else if (segs2.length > 0) {\n            // 全被过滤掉时，不让她替自己或不在场的人说话；但「人在哪」要照实答"
if old in s:
    print('found fallback block')
else:
    print('WARN: fallback block not found')

# 在 normalizeMemberReply 之后加"到场旁白"
anchor = "        reply = normalizeMemberReply(reply, {"
if anchor not in s:
    print('WARN: normalize call not found')
else:
    idx = s.find(anchor)
    end = s.find('});', idx)
    end = s.find('\n', end) + 1
    block = (
        "\n"
        "        // 刚换了地方：别回\"没人应声\"，直接报到场\n"
        "        if (/没人应声/.test(String(reply))) {\n"
        "          const placeNow = String(wPost.places?.[locPost]?.name || '');\n"
        "          if (placeNow) reply = `【${placeNow}】：（你到了${placeNow}。）`;\n"
        "        }\n"
    )
    s = s[:end] + block + s[end:]
    print('added arrival narration')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
