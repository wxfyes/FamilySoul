import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "    // 天道自己声明\"要收钱/要付钱\"：解析它输出里的 [[pay:标题|选项=价|选项=价]]"
new = """    // 告诉天道：要收钱就这么声明（由相公自己点确认）
    try {
      contextHintEarly += '（【收钱规矩】剧情里若要花钱（房钱、货钱、打点、赏银、聘礼），你在回复末尾附一行 [[pay:名目|选项=价|选项=价]]，例如 [[pay:开房|上房=3|通铺=0.2]]。相公会自己点确认；你没收到确认前，不许写"已经付了/已经进了房"。）\\n';
    } catch { /* 忽略 */ }

    // 天道自己声明\"要收钱/要付钱\"：解析它输出里的 [[pay:标题|选项=价|选项=价]]"""
if old in s and '【收钱规矩】' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已加收钱规矩提示')
