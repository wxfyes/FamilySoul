import io

# ① 服务端：people 带性别
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """            id: a.id, name: a.name, role: a.role || '', place: placeName(a.location || ''),"""
new = """            id: a.id, name: a.name, role: a.role || '', gender: a.gender || 'female',
            place: placeName(a.location || ''),"""
if old in s:
    s = s.replace(old, new, 1)
    print('① people 带性别')
io.open(p, 'w', encoding='utf-8').write(s)

# ② App：每人都给「过去」+「叫来」两个动作，代词按性别
p2 = 'mobile/lib/views/out_and_about_sheet.dart'
d = io.open(p2, encoding='utf-8').read()

old2 = """      for (final p in list.take(g == '其他人' ? 8 : 12)) {
        final here = p['here'] == true;
        final canSummon = p['canSummon'] != false;
        children.add(_row(
          title: (p['name'] ?? '').toString(),
          subtitle: '${p['role'] ?? ''} · ${here ? '就在跟前' : (p['place'] ?? '')}',
          action: here
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text('在场', style: TextStyle(fontSize: 12, color: Color(0xFF22C55E))),
                )
              : TextButton(
                  onPressed: canSummon
                      ? () => _run(() => widget.api.summon((p['id'] ?? '').toString()), '（${p['name']}应声赶来。）')
                      : () => _run(() => widget.api.goTo((p['place'] ?? '').toString()), '（你去找${p['name']}了。）'),
                  child: Text(canSummon ? '叫她来' : '过去找他'),
                ),
        ));
      }"""
new2 = """      for (final p in list.take(g == '其他人' ? 8 : 12)) {
        final here = p['here'] == true;
        final canSummon = p['canSummon'] != false;
        final isMale = (p['gender'] ?? '') == 'male';
        final he = isMale ? '他' : '她';
        final placeName = (p['place'] ?? '').toString();
        children.add(_row(
          title: (p['name'] ?? '').toString(),
          subtitle: '${p['role'] ?? ''} · ${here ? '就在跟前' : placeName}',
          action: here
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text('在场', style: TextStyle(fontSize: 12, color: Color(0xFF22C55E))),
                )
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // 过去找她/他
                    TextButton(
                      onPressed: placeName.isEmpty
                          ? null
                          : () => _run(() => widget.api.goTo(placeName), '（你去找${p['name']}了。）'),
                      child: Text('去$he这'),
                    ),
                    // 叫她/他来（真人不给这个）
                    if (canSummon)
                      TextButton(
                        onPressed: () => _run(() => widget.api.summon((p['id'] ?? '').toString()), '（${p['name']}应声赶来。）'),
                        child: Text('叫$he来'),
                      ),
                  ],
                ),
        ));
      }"""
if old2 in d:
    d = d.replace(old2, new2, 1)
    print('② 找人给两个动作 + 代词')
else:
    print('WARN: 找人渲染段没找到')
io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
