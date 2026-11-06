import io
p = 'src/world/goods.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "/** 卖米：铺面/牙行抽三分，剩的进账 */"
add = """/** 只记货、不再扣钱（钱已由付款入口扣过） */
export function addRice(world, whoId, dou) {
  const qty = Math.floor(num(dou));
  if (!(qty > 0)) return { ok: false, line: '' };
  bag(world, whoId).rice += qty;
  return { ok: true, line: `\\uFF08\\u5403\\u8fdb ${qty} \\u6597\\u7c73\\uFF0C\\u5df2\\u5165\\u4ed3\\u3002\\u73b0\\u5b58 ${bag(world, whoId).rice} \\u6597\\u3002\\uFF09` };
}

""" + anchor
if 'export function addRice' not in s and anchor in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('addRice ok')
