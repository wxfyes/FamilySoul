import io

# ① 服务端：分组按"看的人"来定
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """        const rel = (a) => a.relations?.husband || {};
        const isIntimate = (a) => (a.intimacy && a.intimacy.consummated) || Number(rel(a).trust) >= 60;
        const group = (a) => (a.household ? '府内' : isIntimate(a) ? '相好' : '其他人');"""
new = """        const rel = (a) => a.relations?.husband || {};
        const isIntimate = (a) => (a.intimacy && a.intimacy.consummated) || Number(rel(a).trust) >= 60;
        const isHusbandViewer = actorId === 'husband';
        // 分组按"看的人"来定：相公用"府内/相好"，她的号用"我的人/王家/其他"
        const group = (a) => {
          if (isHusbandViewer) {
            if (a.household) return '府内';
            return isIntimate(a) ? '相好' : '其他人';
          }
          // 她的视角
          if (a.id === 'husband') return '我的人';
          if (a.spouse === actorId || (me?.spouse && a.id === me.spouse)) return '我的人';
          if (a.household) return '王家';
          if (a.id === actorId) return '我的人';
          return '其他人';
        };"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 分组按视角切换')
else:
    print('WARN: 分组代码没找到')

# 排序值也要跟着视角走
old2 = """          .sort((x, y) => {
            const o = { 府内: 0, 相好: 1, 其他人: 2 };
            if (o[x.group] !== o[y.group]) return o[x.group] - o[y.group];
            return y.trust - x.trust;
          })"""
new2 = """          .sort((x, y) => {
            const o = isHusbandViewer
              ? { 府内: 0, 相好: 1, 其他人: 2 }
              : { 我的人: 0, 王家: 1, 其他人: 2 };
            const ax = o[x.group] ?? 9;
            const ay = o[y.group] ?? 9;
            if (ax !== ay) return ax - ay;
            return y.trust - x.trust;
          })"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 排序按视角')
else:
    print('WARN: 排序段没找到')

io.open(p, 'w', encoding='utf-8').write(s)

# ② App：分组改为按返回顺序动态渲染
p2 = 'mobile/lib/views/out_and_about_sheet.dart'
d = io.open(p2, encoding='utf-8').read()

old3 = """    final groups = <String, List>{};
    for (final p in people) {
      final g = (p['group'] ?? '其他人').toString();
      groups.putIfAbsent(g, () => []).add(p);
    }
    final children = <Widget>[];
    for (final g in ['府内', '相好', '其他人']) {"""
new3 = """    final groups = <String, List>{};
    for (final p in people) {
      final g = (p['group'] ?? '其他人').toString();
      groups.putIfAbsent(g, () => []).add(p);
    }
    // 按服务端给的视角分组渲染（相公：府内/相好/其他人；她：我的人/王家/其他人）
    final order = ['我的人', '府内', '王家', '相好', '其他人'];
    final names = groups.keys.toList()
      ..sort((a, b) {
        final ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    final children = <Widget>[];
    for (final g in names) {"""
if old3 in d:
    d = d.replace(old3, new3, 1)
    print('③ App 分组动态渲染')
else:
    print('WARN: App 分组段没找到')

io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
