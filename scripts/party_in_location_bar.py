import io

# ① 服务端：/api/me 的 party 带上名字
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = "        party: isHusband ? { members: Array.isArray(world.party?.husband) ? world.party.husband : [] } : { leading: (world.party?.husband || []).includes(actorId) ? 'husband' : null },"
new = """        party: (() => {
          const nameOf = (id) => world.actors?.[id]?.name || id;
          const ids = Array.isArray(world.party?.husband) ? world.party.husband : [];
          const here = ids.filter((id) => world.actors?.[id] && !world.actors[id].dead);
          if (isHusband) {
            return { members: here, names: here.map(nameOf) };
          }
          const leading = here.includes(actorId) ? 'husband' : null;
          // 她那边：告诉你正跟着谁、还有谁一起
          return {
            leading,
            leaderName: leading ? (world.actors?.husband?.name || '相公') : null,
            names: leading ? here.filter((id) => id !== actorId).map(nameOf) : [],
          };
        })(),"""
if old in s:
    s = s.replace(old, new, 1)
    print('① /api/me 的 party 带名字')
else:
    print('WARN: party 字段没找到')
io.open(p, 'w', encoding='utf-8').write(s)

# ② App：位置条后面显示同行
p2 = 'mobile/lib/views/chat_screen.dart'
d = io.open(p2, encoding='utf-8').read()
if '_partyNames' not in d:
    d = d.replace("  Timer? _locTimer;", "  Timer? _locTimer;\n  List<String> _partyNames = const [];", 1)
    print('② 状态字段 _partyNames')

    old2 = """      final place = (self['place'] ?? '').toString();
      if (place.isEmpty) return;"""
    new2 = """      final place = (self['place'] ?? '').toString();
      if (place.isEmpty) return;
      // 同行的人
      List<String> names = const [];
      final party = d['party'];
      if (party is Map) {
        if (party['names'] is List) {
          names = (party['names'] as List).map((x) => x.toString()).where((x) => x.isNotEmpty).toList();
        } else if (party['members'] is List && (party['members'] as List).isNotEmpty) {
          // 相公视角只有 id，这里退回用 id 展示
          names = (party['members'] as List).map((x) => x.toString()).toList();
        }
      }"""
    if old2 in d:
        d = d.replace(old2, new2, 1)
        print('③ 解析同行名单')

    old3 = """        setState(() {
          _placeName = place;
          _worldDay = day;
          _worldHour = hour;
        });"""
    new3 = """        setState(() {
          _placeName = place;
          _worldDay = day;
          _worldHour = hour;
          _partyNames = names;
        });"""
    if old3 in d:
        d = d.replace(old3, new3, 1)
        print('④ 写入同行名单')

# UI：位置条里加同行显示
old4 = """                          if (_worldDay > 0)
                            Text(
                              '第$_worldDay日 $_worldHour时',
                              style: const TextStyle(color: Colors.white30, fontSize: 11.5),
                            ),"""
new4 = """                          if (_partyNames.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Text(
                                _partyNames.length <= 2
                                    ? '与${_partyNames.join('、')}同行'
                                    : '与${_partyNames.take(2).join('、')}等${_partyNames.length}人同行',
                                style: const TextStyle(color: Color(0xFF9B8CF6), fontSize: 11.5),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          if (_worldDay > 0)
                            Text(
                              '第$_worldDay日 $_worldHour时',
                              style: const TextStyle(color: Colors.white30, fontSize: 11.5),
                            ),"""
if old4 in d and '与${_partyNames' not in d:
    d = d.replace(old4, new4, 1)
    print('⑤ 位置条显示同行')

io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
