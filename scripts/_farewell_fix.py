import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const farewellSay = /^(?:你|你们|都|先)?\\s*(?:走|回去吧|回吧|退下|下去|散了|去吧|出门吧|慢走|送客)[。！!~…\\s]*$/.test(String(sayText || '').trim())
        || /送客|你回吧|你走吧|退下吧|都散了吧/.test(String(sayText || '').trim());"""
new = """      const farewellSay = /^(?:你|你们|都|先)?\\s*(?:走|回去吧|回吧|退下|下去|散了|去吧|出门吧|慢走|送客)[。！!~…\\s]*$/.test(String(sayText || '').trim())
        || /送客|你回吧|你走吧|退下吧|都散了吧/.test(String(sayText || '').trim())
        || /让.{0,10}(走|回去|回房|退下|出去|散了)/.test(String(sayText || ''))
        || /叫他们.{0,4}(走|回去|出去)|都回(房|屋|去)|散了吧|退下/.test(String(sayText || ''));"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 送客话术放宽')

old2 = """        const goers0 = hereF.filter((a) => !(a.household && meF?.id === 'husband'));"""
new2 = """        // 妻妾丫鬟也要真的回自己房里去，不再"嘴上告退、人还在"
        const goers0 = hereF.slice();"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 内眷也走')

# ③ 拆掉写死的兜底台词
old3 = """          const fallbacks = [
            '【正妻·婉儿】：“相公，妾身在呢。方才正盘着店里的账，相公吩咐便是，妾身听着呢。”',
            '【正妻·婉儿】：“相公莫烦心，外间有些琐事，妾身已让阿吉去料理了。相公有何交代的，妾身一直在身边。”',
            '【正妻·婉儿】：“相公今日辛苦了。妾身一直候在身旁，相公说什么，妾身都记在心里的。”'
          ];
          fallbackReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];"""
new3 = """          // 不再念写死的台词：出了故障就如实说一句，不替角色编话
          fallbackReply = '（屋里静了一息，没有人应声。）';"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 拆兜底台词')
io.open(p, 'w', encoding='utf-8-sig').write(s)
