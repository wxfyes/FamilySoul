import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "            jailed: a.jailed || null, dead: Boolean(a.dead),"
new = ("            jailed: a.jailed || null, dead: Boolean(a.dead),\n"
       "            money: typeof a.money === 'number' ? a.money : null,\n"
       "            debt: Number(a.debt) || 0,\n"
       "            onPeriod: Boolean(a.menses?.on),\n"
       "            cycleDay: typeof a.menses?.cycleDay === 'number' ? a.menses.cycleDay : null,\n"
       "            fertile: (() => {\n"
       "              const m = a.menses;\n"
       "              if (!m || typeof m.cycleDay !== 'number' || m.on) return false;\n"
       "              return m.cycleDay >= 9 && m.cycleDay <= 16;\n"
       "            })(),\n"
       "            pregnant: Boolean(a.pregnancy && !a.pregnancy.born),\n"
       "            pregnantDays: Number(a.pregnancy?.days) || 0,")
if old in s and 'onPeriod: Boolean(a.menses?.on),' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('详情接口已补 钱/月事/易孕/身孕')
else:
    print('already or anchor missing')
