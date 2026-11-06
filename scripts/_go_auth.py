import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        const member = resolveMember(req, url);
        const actorId = member?.actor || 'husband';
        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进"""
new = """        const member = resolveMember(req, url);
        // 没令牌就是外人：绝不允许"空令牌默认当相公"（否则任何人都能把王甯挪走）
        if (!member) return sendJson(res, 401, { ok: false, error: '通行令牌无效：请先登录' });
        const actorId = member.actor || 'husband';
        // 说的是人（去找王甯）：先换成他此刻所在的地方，再由门禁决定能不能进"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① go 必须带令牌')
