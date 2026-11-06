import io
# ① 服务端：出身只写"年岁与身份状态"，不写职业
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find('    const ROLE_MAP = {')
end = s.find('    };', start)
if start > 0 and end > 0:
    new = """    // 出身只描述"年岁与身份状态"，不给职业——职业是他自己在这个世界里挣出来的
    const ROLE_MAP = {
      girl: '及笄少女',
      boy: '少年郎',
      youngWoman: '青年女子',
      youngMan: '青年男子',
      bride: '新妇',
      matron: '少妇',
      primeWoman: '当家妇人',
      primeMan: '壮年男子',
      middleWoman: '中年妇人',
      middleMan: '中年男子',
      elderWoman: '老妇',
      elderMan: '老者',
    };
"""
    s = s[:start] + new + s[end+7:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 服务端出身改为年岁状态')
