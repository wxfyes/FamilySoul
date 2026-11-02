import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        const pat = /([\\u4e00-\\u9fa5]{2,4})(婆子|娘子|老汉|汉子|货郎|船夫|郎中|秀才|掌柜|妇人|脚夫|绣娘|花子|屠户|车夫)/g;"
)
new = (
    "        const pat = /([\\u4e00-\\u9fa5]{2,4})(婆子|娘子|老汉|汉子|货郎|船夫|郎中|秀才|掌柜|妇人|脚夫|绣娘|花子|屠户|车夫|婶子|大娘|婆婆|老头|大叔|阿婆|小厮|丫鬟)/g;\n"
    "        const BAD_NAME = /(去|请|叫|让|来|说|道|这|那|个|快|先|就|还|再|把|被|给|跟|和|与|要|得|的|了|着|过|一|两|三|几|您|你|我|他|她|又|也|都|才|只|便|即)/;"
)
if old in s:
    s = s.replace(old, new)
    print('patched: name sanity filter set')

old2 = (
    "          const nm = m2[1];\n"
    "          if (known.has(nm) || /(自己|我们|他们|你们|咱们|人家)/.test(nm)) continue;"
)
new2 = (
    "          const nm = m2[1];\n"
    "          if (BAD_NAME.test(nm)) continue;           // 动词/代词不能当名字\n"
    "          if (known.has(nm) || /(自己|我们|他们|你们|咱们|人家)/.test(nm)) continue;"
)
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: reject verb-ish names')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
