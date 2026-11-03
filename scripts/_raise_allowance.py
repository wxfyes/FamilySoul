import io
p = 'src/world/clock.js'
s = io.open(p, encoding='utf-8-sig').read()

pairs = [
  ("{ re: /正妻|大娘子/, amount: 3.0 },", "{ re: /正妻|大娘子/, amount: 5.0 },"),
  ("{ re: /如夫人|二房|侧室|妾/, amount: 2.0 },", "{ re: /如夫人|二房|侧室|妾/, amount: 3.0 },"),
  ("{ re: /通房|贴身丫鬟|丫鬟|丫头/, amount: 0.5 },", "{ re: /通房|贴身丫鬟|丫鬟|丫头/, amount: 0.8 },"),
  ("const OUTSIDER = 1.5;   // 外室（不入府，暗中给）", "const OUTSIDER = 2.0;   // 外室（不入府，暗中给）"),
  ("const CHILD = 0.2;      // 每个孩子", "const CHILD = 0.3;      // 每个孩子"),
]
n = 0
for a, b in pairs:
    if a in s:
        s = s.replace(a, b, 1); n += 1
io.open(p, 'w', encoding='utf-8').write(s)
print('已调整', n, '档')
