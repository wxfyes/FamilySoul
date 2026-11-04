with open('web/dashboard.html.bak-before-sidebar', 'r', encoding='utf-8') as f:
    c = f.read()

idx = c.find("const bar =")
if idx != -1:
    print(c[idx:idx+1200])

# 看看 CSS 里的 .bar 样式
css_idx = c.find(".bar")
while css_idx != -1:
    print("CSS .bar:", c[css_idx:css_idx+150])
    css_idx = c.find(".bar", css_idx + 1)
