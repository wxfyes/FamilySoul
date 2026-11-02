import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "          location: resolvePlace(world, args.place) || 'street',"
new = (
    "          location: (() => {\n"
    "            const asked = resolvePlace(world, args.place);\n"
    "            if (asked) return asked;\n"
    "            // 按行当给个自己的地方：郎中开药铺、稳婆有家、绣娘有绣坊\n"
    "            const r = String(args.role || '');\n"
    "            let placeName = '';\n"
    "            if (/郎中|大夫|医/.test(r)) placeName = `${name}的药铺`;\n"
    "            else if (/稳婆|接生/.test(r)) placeName = `${name}家`;\n"
    "            else if (/媒婆|牙婆/.test(r)) placeName = `${name}家`;\n"
    "            else if (/绣娘|绣/.test(r)) placeName = `${name}的绣坊`;\n"
    "            else if (/仵作|衙役|更夫/.test(r)) return 'yamen';\n"
    "            else if (/掌柜|东家/.test(r)) placeName = `${name}的铺子`;\n"
    "            else if (/道士|尼姑/.test(r)) placeName = `${name}的道观`;\n"
    "            if (!placeName) return 'street';\n"
    "            world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;\n"
    "            const pid = `place_${world.flags.placeSeq}`;\n"
    "            world.places[pid] = { name: placeName.slice(0, 20), exits: ['street'], owner: id, dynamic: true };\n"
    "            return pid;\n"
    "          })(),"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: spawn gives each a place')
else:
    print('WARN: location line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
