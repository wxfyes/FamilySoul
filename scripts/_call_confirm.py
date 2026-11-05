import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          const rMil = pend.action === 'gear'
            ? buyGear(world, 'wangjia', String(pend.gearKind || 'weapon'), Number(pend.qty) || 0)
            : recruit(world, 'wangjia', Number(pend.qty) || 0, String(pend.city || ''), String(pend.recruitKind || 'guard'));"""
new = """          const rMil = pend.action === 'gear'
            ? buyGear(world, 'wangjia', String(pend.gearKind || 'weapon'), Number(pend.qty) || 0)
            : (pend.action === 'call'
              ? callToArms(world, 'wangjia', { city: String(pend.city || ''), max: Number(pend.qty) || 20, kind: String(pend.recruitKind || 'guard') })
              : recruit(world, 'wangjia', Number(pend.qty) || 0, String(pend.city || ''), String(pend.recruitKind || 'guard')));"""
if old in s:
    s = s.replace(old, new, 1)
    print('确认单支持 call')
# 文案：来投人数
s = s.replace("""          const line = pend.action === 'gear'
            ? `（已购军械，银两照扣。现存：${JSON.stringify(rMil.gear || {})}）`
            : `（已募 ${pend.qty} 人，成军需七日。现总兵 ${rMil.troops}，驻 ${rMil.city}。）`;""",
"""          const line = pend.action === 'gear'
            ? `（已购军械，银两照扣。现存：${JSON.stringify(rMil.gear || {})}）`
            : (pend.action === 'call'
              ? `（一呼百应，来投 ${rMil.came} 人。现总兵 ${rMil.troops}，驻 ${rMil.city}，月饷 ${rMil.monthlyPay} 两。）`
              : `（已募 ${pend.qty} 人，成军需七日。现总兵 ${rMil.troops}，驻 ${rMil.city}。）`);""")
io.open(p, 'w', encoding='utf-8-sig').write(s)
