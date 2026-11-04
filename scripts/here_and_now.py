import io

# ① /api/me 带"此处有谁"
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """      const place = me?.location ? world.places?.[me.location] : null;"""
new = """      const place = me?.location ? world.places?.[me.location] : null;
      // 此处有谁：站在同一地点的人（不含自己）
      const hereNames = Object.values(world.actors || {})
        .filter((a) => a && !a.dead && a.name && a.location === me?.location && a.id !== (actorId || 'husband'))
        .map((a) => ({ name: a.name, role: a.role || '', activity: a.activity?.text || '' }))
        .slice(0, 8);"""
if old in s and 'hereNames' not in s:
    s = s.replace(old, new, 1)
    print('① 统计此处有谁')

old2 = """        self: { name: me?.name || '', role: me?.role || '', place: place?.name || '', isHusband },"""
new2 = """        self: { name: me?.name || '', role: me?.role || '', place: place?.name || '', isHusband },
        here: hereNames,"""
if old2 in s and 'here: hereNames' not in s:
    s = s.replace(old2, new2, 1)
    print('② /api/me 下发 here')

io.open(p, 'w', encoding='utf-8').write(s)

# ③ App：位置条第二行显示此处有谁
p2 = 'mobile/lib/views/chat_screen.dart'
d = io.open(p2, encoding='utf-8').read()

if '_hereNames' not in d:
    d = d.replace("  List<String> _partyNames = const [];",
                  "  List<String> _partyNames = const [];\n  List<String> _hereNames = const [];", 1)
    print('③ 状态 _hereNames')

    old3 = """      if (place != _placeName || day != _worldDay || hour != _worldHour) {
        setState(() {
          _placeName = place;
          _worldDay = day;
          _worldHour = hour;
          _partyNames = names;
        });
      }"""
    new3 = """      // 此处有谁
      List<String> here = const [];
      if (d['here'] is List) {
        here = (d['here'] as List)
            .map((x) => (x is Map) ? (x['name'] ?? '').toString() : '')
            .where((x) => x.isNotEmpty)
            .toList();
      }
      if (place != _placeName || day != _worldDay || hour != _worldHour || here.join(',') != _hereNames.join(',')) {
        setState(() {
          _placeName = place;
          _worldDay = day;
          _worldHour = hour;
          _partyNames = names;
          _hereNames = here;
        });
      }"""
    if old3 in d:
        d = d.replace(old3, new3, 1)
        print('④ 解析此处有谁')

io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
