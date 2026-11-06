import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { ensureCityBase, ensureAllCityBases, ensureCityExtras, ensureCityClasses, streetOfCity } from './city.js';",
              "import { ensureCityBase, ensureAllCityBases, ensureCityExtras, ensureCityClasses, ensureShopStaff, streetOfCity } from './city.js';", 1)
anchor = "      // 一次性：客栈掌柜站到前店柜台"
add = """      // 一次性：所有城的铺面配人（掌柜/跑堂/伙计/摊主）
      try {
        if (!world.flags?.shopStaffV1) {
          let n = 0;
          for (const cn of Object.keys(world.flags?.cityBase || {})) {
            try { n += ensureShopStaff(world, cn); } catch { /* 忽略 */ }
          }
          world.flags = world.flags || {};
          world.flags.shopStaffV1 = { at: Date.now(), n };
          console.log(`[Shop] 全城铺面配人：${n} 名`);
        }
      } catch { /* 忽略 */ }

""" + anchor
if 'shopStaffV1' not in s and anchor in s:
    s = s.replace(anchor, add + anchor, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('shopStaff 迁移')
