import io

p = 'src/world/summon.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "      me.location = pid;\n"
    "      saveState(dataDir, world);\n"
    "      console.log(`[World] 天道造了一处「${wantName}」`);"
)
new = (
    "      me.location = pid;\n"
    "      // 顺手配个人：造了铺子就得有掌柜/郎中/镖头，别是空屋\n"
    "      try {\n"
    "        const KEEPER = [\n"
    "          { re: /医馆|药铺|药堂|医/, role: '郎中', given: ['郎中', '大夫', '先生'] },\n"
    "          { re: /银楼|金铺|当铺/, role: '掌柜', given: ['掌柜'] },\n"
    "          { re: /镖局/, role: '镖头', given: ['镖头'] },\n"
    "          { re: /酒楼|饭庄|客栈|茶楼|茶馆/, role: '掌柜', given: ['掌柜'] },\n"
    "          { re: /布庄|衣庄|绣坊|绣楼/, role: '掌柜', given: ['掌柜'] },\n"
    "          { re: /铁铺|铁匠|银楼/, role: '匠人', given: ['师傅'] },\n"
    "          { re: /赌坊|青楼/, role: '管事', given: ['管事'] },\n"
    "        ];\n"
    "        const hitK = KEEPER.find((x) => x.re.test(wantName));\n"
    "        const SUR = '陈王李周柳秦赵钱孙吴郑冯褚卫蒋沈韩杨朱许何吕施张孔曹严华金魏陶姜苏潘葛范彭鲁韦马方任袁柳唐薛雷贺倪汤罗毕郝安常傅齐康伍余顾孟黄萧尹姚邵汪毛戴宋庞熊纪舒项董梁杜阮蓝闵季麻贾路娄江童颜郭梅盛林钟徐邱骆高夏蔡田樊胡凌霍虞万柯卢莫房裘解应宗丁邓单杭洪包左石崔龚程邢裴陆荣翁荀惠甄曲封芮储靳段富巫乌焦巴牧山谷车侯全班秋仲伊宫宁仇甘厉祖武符刘景詹龙叶黎薄印宿白怀蒲从鄂索咸赖卓蔺屠蒙池乔翟谭贡劳姬申扶冉雍桑桂牛边燕浦尚温庄晏柴瞿阎慕连茹艾鱼容向古易慎戈廖庾终居衡步都耿满弘匡国文寇广禄阙东欧沃利越师巩聂晁敖冷辛简饶曾沙鞠丰巢关蒯查后荆红游竺权盖益桓';\n"
    "        const sur = SUR[Math.floor(Math.random() * SUR.length)];\n"
    "        const given = hitK ? hitK.given[Math.floor(Math.random() * hitK.given.length)] : '掌柜';\n"
    "        const nm = `${sur}${given}`;\n"
    "        const dup = Object.values(world.actors || {}).some((a) => a && a.name === nm);\n"
    "        if (!dup) {\n"
    "          world.flags.npcSeq = (Number(world.flags.npcSeq) || 0) + 1;\n"
    "          const kid = `npc_${world.flags.npcSeq}`;\n"
    "          world.actors[kid] = {\n"
    "            id: kid, name: nm, role: `${wantName}${hitK ? hitK.role : '掌柜'}`,\n"
    "            gender: 'male', origin: 'spawned', age: 40 + Math.floor(Math.random() * 15),\n"
    "            home: pid, location: pid, activity: { text: '守铺子', at: world.clock?.hour || 0, day: world.clock?.day || 1 },\n"
    "            relations: { husband: { trust: 25, desire: 0, fear: 0, grievance: 0 } }, schedule: [],\n"
    "          };\n"
    "          console.log(`[World] 顺手造了个人「${nm}」（${world.actors[kid].role}）`);\n"
    "        }\n"
    "      } catch (err) { console.warn('[World] 配人失败：', err.message); }\n"
    "      saveState(dataDir, world);\n"
    "      console.log(`[World] 天道造了一处「${wantName}」`);"
)
if old in s and '顺手造了个人' not in s:
    s = s.replace(old, new, 1)
    print('patched: created place gets a keeper')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
