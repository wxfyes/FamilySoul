import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find("      // 一次性：只保留大城的基底，把早先铺过头的小城清掉（省地点与人口）")
end = s.find("      // 城市基底：先把大城铺一遍（幂等，只做一次），外城才有人可打交道", start)
if start > 0 and end > start:
    s = s[:start] + s[end:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('撤掉清城迁移，保留全城基底')
