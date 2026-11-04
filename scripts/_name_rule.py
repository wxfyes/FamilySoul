import io
# 服务端：名字不能全是虚词（只会/那个/上来…），按"类别"判，不列个案
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """    const placeCheck = isPlaceName(rawName);"""
new = """    // 虚词规则：两个字全是"只/会/那/个/上/来/什/么"这类虚词，就不是名字
    const FUNCTION_CHARS = new Set('只会那个上来什么不是就可以已经的着了和与我你他她它们这没有在到把被让给对从向为因所但而或且如若虽然很太更最都也还又再才其因此则乃');
    if ([...rawName].every((ch) => FUNCTION_CHARS.has(ch))) {
      return { ok: false, error: '此名不似人名，请取一个有姓氏或雅号的名字' };
    }

    const placeCheck = isPlaceName(rawName);"""
if old in s and 'FUNCTION_CHARS' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 服务端加虚词规则')
