import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 给回复里的花名补上"身份前缀"：鲁青 → 帮工·鲁青（身份由账上 role 推，不写死）
anchor = "    const now = Date.now();\n    let audioKey = null;"
add = """    // 给每个发言人补身份前缀（帮工/掌柜/正妻/丫鬟…），由账上 role 推，不写死
    try {
      const wS = loadState(this.dataDir);
      reply = String(reply || '').replace(/【([^】\\n]{1,12})】/g, (m0, name0) => {
        const nm = String(name0).trim();
        if (/[·・]/.test(nm) || /天道|旁白|众人/.test(nm)) return m0;
        const a = Object.values(wS.actors || {}).find((x) => x && !x.dead && x.name === nm);
        if (!a) return m0;
        const role = String(a.role || '').trim();
        if (!role) return m0;
        let title = role
          .replace(/^临江府?/, '')
          .replace(/（.*?）/g, '')
          .replace(/的$/, '')
          .trim();
        if (title.length > 6) {
          const m1 = title.match(/(帮佣|帮工|伙计|掌柜|东家|老板娘|正妻|如夫人|二房|丫鬟|丫头|学徒|脚夫|货郎|船夫|郎中|大夫|教头|护院|家丁|知府|知县|书办|典吏|更夫|稳婆|媒婆|绣娘|卖花女|游侠|和尚|道士)/);
          title = m1 ? m1[1] : title.slice(0, 4);
        }
        if (!title || title === nm) return m0;
        return `【${title}·${nm}】`;
      });
    } catch { /* 忽略 */ }

""" + anchor
if '身份前缀' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 回复花名补身份前缀')
