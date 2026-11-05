import io
# 迁移：清掉历史里被量词骗出来的假产业
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'propertyCleanupV1' not in s:
    anchor = "  // 空间清理（串模板房间 / 小贩归位 / 补房间 / 门路）"
    add = """  // 一次性：清掉"几个铺子/若干铺"这类被量词骗出来的假产业
  try {
    world.flags = world.flags || {};
    if (!world.flags.propertyCleanupV1) {
      const props = Array.isArray(world.assets?.properties) ? world.assets.properties : [];
      const before = props.length;
      const bad = [];
      world.assets.properties = props.filter((p) => {
        const nm = String(p?.name || '');
        const fake = /^(几|多|若干|一些|这个|那个|某)/.test(nm) && !/铺|号|栈|坊|楼|店|行|庄|堂/.test(nm.slice(1));
        if (fake) bad.push(nm);
        return !fake;
      });
      world.flags.propertyCleanupV1 = { removed: before - world.assets.properties.length };
      if (bad.length) console.log(`[Property] 清掉假产业：${bad.join('、')}`);
    }
  } catch { /* 忽略 */ }

""" + anchor
    if anchor in s:
        s = s.replace(anchor, add, 1)
        io.open(p, 'w', encoding='utf-8-sig').write(s)
        print('① 加假产业清理')
