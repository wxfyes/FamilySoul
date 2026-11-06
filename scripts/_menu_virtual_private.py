import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """              if (world.places[rec.id]) continue;   // 已展开的已经在列表里
              if (places.some((x) => x.id === rec.id)) continue;
              places.push({"""
new = """              if (world.places[rec.id]) continue;   // 已展开的已经在列表里
              if (places.some((x) => x.id === rec.id)) continue;
              // 虚拟补进来的院子也要过私房这一关：后厨、库房、雅间、上房，一律不列
              const fullName = `${houseName}·${rec.name}`;
              if (/后坊|库房|后厨|酒窖|雅间|上房|暖阁|厢房|卧房|下房|值房|账房|书房|祠堂|仓房|柴房|马厩/.test(fullName)) continue;
              const acc = String(rec.access || '');
              if (acc && !['public_outer', 'guest_main', 'guest_outer', 'public_shop'].includes(acc)) continue;
              places.push({"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 虚拟院子同样过滤私房')
