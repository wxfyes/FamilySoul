import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (title.length > 6) {
          const m1 = title.match(/(帮佣|帮工|伙计|掌柜|东家|老板娘|正妻|如夫人|二房|丫鬟|丫头|学徒|脚夫|货郎|船夫|郎中|大夫|教头|护院|家丁|知府|知县|书办|典吏|更夫|稳婆|媒婆|绣娘|卖花女|游侠|和尚|道士)/);
          title = m1 ? m1[1] : title.slice(0, 4);
        }"""
new = """        if (title.length > 6) {
          const mTail = title.match(/(老板娘|掌柜|东家|名伶|花魁|帮佣|帮工|伙计|丫鬟|丫头|小厮|家丁|护院|管事|管家|厨娘|账房|书吏|典吏|知府|知县|捕快|更夫|船夫|货郎|郎中|学徒|脚夫|游侠|官差|车夫|马夫|教头|绣娘|媒婆)$/);
          if (mTail) {
            title = mTail[1];
          } else {
            const m1 = title.match(/(帮佣|帮工|伙计|掌柜|东家|正妻|如夫人|二房|丫鬟|丫头|学徒|脚夫|货郎|船夫|郎中|大夫|教头|护院|家丁|知府|知县|书办|典吏|更夫|稳婆|媒婆|绣娘|卖花女|游侠|和尚|道士)/);
            title = m1 ? m1[1] : title.slice(-4);
          }
        }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 身份取后缀词，长角色名不再乱截')
