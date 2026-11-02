import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "        contextHint += `（【此间铁律】"
idx = s.find(anchor)
if idx < 0:
    print('WARN: iron rule anchor not found')
else:
    # 在她那侧的 try 块末尾追加"数字口径"
    insert_after = s.find("\n", s.find("他若不在跟前，只说他此刻不在这儿。）\\n`;", idx))
    if insert_after < 0:
        print('WARN: end of iron rule line not found')
    else:
        block = (
            "\n        // 问钱就报账本上的数，省得它自己编\n"
            "        if (/(进多少|日入|收入|赚多少|多少钱|几两)/.test(String(say || ''))) {\n"
            "          const myProps = (wHere.assets?.properties || []).filter((p) => p && p.keeper === this._viewerActorId);\n"
            "          const daily = myProps.reduce((sum, p) => sum + (Number(p.incomePerDay) || 0), 0);\n"
            "          const wallet = Number(wHere.wallets?.[this._viewerActorId]) || 0;\n"
            "          const detail = myProps.map((p) => `${p.name}${Number(p.incomePerDay) || 0}两`).join('、') || '名下没有产业';\n"
            "          contextHint += `（【钱的准数】现银${wallet.toFixed(2)}两，日入${daily.toFixed(2)}两；${detail}。问钱就照这个答，不许自己编数。）\\n`;\n"
            "        }\n"
        )
        s = s[:insert_after] + block + s[insert_after:]
        print('added money hint')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
