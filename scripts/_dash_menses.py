import io
p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

# 家宅行：加"月事"标签
old = "${isPreg(a) ? `<span class=\"tag good\" style=\"margin-left:4px\">有喜 ${Number(a.pregnancy?.days) || 0} 天</span>` : ''}"
new = "${isPreg(a) ? `<span class=\"tag good\" style=\"margin-left:4px\">有喜 ${Number(a.pregnancy?.days) || 0} 天</span>` : ''}${a.onPeriod ? '<span class=\"tag\" style=\"margin-left:4px\">月事</span>' : ''}"
if old in s:
    s = s.replace(old, new, 1)
    print('① 家宅加月事标签')

# 人物表：亲密列显示月事
old2 = "    if (a.pregnancy && !a.pregnancy.born) intimacy = '有孕 · ' + Math.floor((a.pregnancy.days||0)/30) + '个月';"
new2 = old2 + "\n    if (a.onPeriod) intimacy = '月事中';"
if old2 in s and "月事中" not in s:
    s = s.replace(old2, new2, 1)
    print('② 人物表显示月事')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
