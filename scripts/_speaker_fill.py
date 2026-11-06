import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 身份前缀补完之后，再按在场铁律收一遍（防止后段把不在场的人加回来）"
add = """    // 模型没写说话人：由引擎按"这一轮该谁开口"补上（不然气泡没有主）
    try {
      const t = String(reply || '').trim();
      if (t && !/【[^】]{1,12}】/.test(t)) {
        const target = turnTarget?.actor;
        if (target) {
          const label = String(target.title || target.role || target.name || '').trim() || '某人';
          reply = `【${label}·${target.name}】：“${t}”`;
        }
      }
    } catch { /* 忽略 */ }

""" + anchor
if '模型没写说话人' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('缺说话人时补上')
