import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      } else if (kind === 'spawn') {"
idx = s.find(anchor)
if idx < 0:
    print('WARN: spawn branch not found')
else:
    # 在 spawn 分支开头插一道名字体检
    insert_at = s.find('\n', idx) + 1
    guard = (
        "        // 名字体检：\"收拾啥\"\"是新请的\"这种不是名字，一律不造人\n"
        "        {\n"
        "          const nm = String(args.name || '').trim();\n"
        "          const bad = /[啥什谁哪怎吗呢吧啊哦呀]|什么|怎么|干嘛|这个|那个|一个|一下/;\n"
        "          const verbHead = /^(收拾|拾掇|打量|伺候|回话|禀报|应声|起身|退下|领着|跟着|出来|进去|过来|上来)/;\n"
        "          if (!nm || nm.length < 2 || nm.length > 4 || bad.test(nm) || verbHead.test(nm)) {\n"
        "            applied.push(`拒绝造人:名字不像人(${nm})`);\n"
        "            console.log(`[Spawn] 拒绝造人：名字不像人「${nm}」`);\n"
        "            continue;\n"
        "          }\n"
        "        }\n"
    )
    s = s[:insert_at] + guard + s[insert_at:]
    print('added spawn name guard')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
