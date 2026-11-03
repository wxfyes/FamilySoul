import io

# ① dispatch：名字必须是「姓+名」，否则按身份给个正经名字
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "        {\n"
    "          const nm = String(args.name || '').trim();\n"
    "          const bad = /[啥什谁哪怎吗呢吧啊哦呀]|什么|怎么|干嘛|这个|那个|一个|一下/;\n"
    "          const verbHead = /^(收拾|拾掇|打量|伺候|回话|禀报|应声|起身|退下|领着|跟着|出来|进去|过来|上来)/;\n"
    "          if (!nm || nm.length < 2 || nm.length > 4 || bad.test(nm) || verbHead.test(nm)) {\n"
    "            applied.push(`拒绝造人:名字不像人(${nm})`);\n"
    "            console.log(`[Spawn] 拒绝造人：名字不像人「${nm}」`);\n"
    "            continue;\n"
    "          }\n"
    "        }\n"
)
new = (
    "        {\n"
    "          // 起名规范：姓（百家姓常见）+ 名/称呼，2–3 字；不合规就按身份给个正经名字\n"
    "          const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳酆鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯昝管卢莫经房裘缪干解应宗丁宣贲邓郁单杭洪包诸左石崔吉钮龚程嵇邢滑裴陆荣翁荀羊於惠甄曲家封芮羿储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰从鄂索咸籍赖卓蔺屠蒙池乔阴郁胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍却璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越夔隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾毋沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公';\n"
    "          const ROLE_SUFFIX = [\n"
    "            { re: /掌柜|东家/, suffix: '掌柜' },\n"
    "            { re: /郎中|大夫|医/, suffix: '郎中' },\n"
    "            { re: /婆|妇/, suffix: '婆' },\n"
    "            { re: /娘|姑|女/, suffix: '娘' },\n"
    "            { re: /先生|夫子|教书/, suffix: '先生' },\n"
    "            { re: /伙计|小厮|跑堂|丫头|丫鬟|仆/, suffix: '二' },\n"
    "            { re: /吏|书办|差役|衙役/, suffix: '书办' },\n"
    "          ];\n"
    "          let nm = String(args.name || '').trim();\n"
    "          const bad = /[啥什谁哪怎吗呢吧啊哦呀]|什么|怎么|干嘛|这个|那个|一个|一下|收拾|拾掇/;\n"
    "          const verbHead = /^(收拾|拾掇|打量|伺候|回话|禀报|应声|起身|退下|领着|跟着|出来|进去|过来|上来|去|来|说|做)/;\n"
    "          const looksLikeName = nm && nm.length >= 2 && nm.length <= 3 && !bad.test(nm) && !verbHead.test(nm) && SURNAMES.includes(nm[0]);\n"
    "          if (!looksLikeName) {\n"
    "            const role = String(args.role || '城中人');\n"
    "            const hit = ROLE_SUFFIX.find((x) => x.re.test(role));\n"
    "            const sn = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];\n"
    "            const fixed = `${sn}${hit ? hit.suffix : '三'}`;\n"
    "            console.log(`[Spawn] 名字不规范「${nm}」→ 按身份改名「${fixed}」（${role}）`);\n"
    "            applied.push(`改名:${nm || '(空)'}→${fixed}`);\n"
    "            args.name = fixed;\n"
    "            nm = fixed;\n"
    "          }\n"
    "        }\n"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: naming convention + auto rename')
else:
    print('WARN: guard block not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
