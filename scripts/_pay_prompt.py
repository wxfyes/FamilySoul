import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "contextHintEarly += '（【收钱规矩】剧情里若要花钱（房钱、货钱、打点、赏银、聘礼），你在回复末尾附一行 [[pay:名目|选项=价|选项=价]]，例如 [[pa"
new = "contextHintEarly += '（【收钱规矩】剧情里若要花钱（房钱、货钱、打点、赏银、聘礼），你在回复末尾附一行 [[pay:名目|选项=价|选项=价]]，**每改一次价、每换一个数目，都必须重新写一行新的 [[pay]]，否则玩家看到的仍是上一张旧单**，例如 [[pa"
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('提示词：改价必须重下单')
