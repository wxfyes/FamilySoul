import io

# 规则行在 member-card.js 里
p = 'src/world/member-card.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "【规矩】只认这五条。名单外的人不存在；不在场的人不许说成在场；你自己不替自己说话。"
new = ("【规矩】只认这五条。名单外的人不存在；不在场的人不许说成在场；你自己不替自己说话。"
       "王甯在场时，你找他他就得自己开口，不许让伙计挡驾。")
if old in s:
    s = s.replace(old, new)
    print('patched member-card rule')
else:
    print('WARN: rule not found in member-card')
io.open(p, 'w', encoding='utf-8').write(s)

# 另外：王甯在场时，把他的台词保下来（他本身就是"在场的人"）
p2 = 'src/pet-service.js'
s2 = io.open(p2, encoding='utf-8-sig').read()
marker = "          const hereB = new Set("
if marker in s2 and "王甯" not in s2[s2.find(marker):s2.find(marker)+400]:
    s2 = s2.replace(
        marker,
        "          const hereB = new Set(\n"
        "            ['王甯', '相公', '王掌柜', '少掌柜'],\n",
    )
    print('patched: 王甯 always allowed to speak')
else:
    print('WARN: hereB marker not found or already patched')
io.open(p2, 'w', encoding='utf-8').write(s2)
print('ok')
