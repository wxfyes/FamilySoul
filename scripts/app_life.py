import io

p = 'mobile/lib/views/my_world_screen.dart'
s = io.open(p, encoding='utf-8-sig').read()

anchor = "      _sectionTitle('我的人马'),"
if anchor not in s:
    print('WARN: anchor not found')
else:
    section = (
        "      // 家中（生老病死）\n"
        "      if ((d['life'] as Map?) != null) ...[\n"
        "        _sectionTitle('家中'),\n"
        "        _cardShell(\n"
        "          child: Column(\n"
        "            crossAxisAlignment: CrossAxisAlignment.start,\n"
        "            children: [\n"
        "              if ((d['life'] as Map)['age'] != null)\n"
        "                Padding(\n"
        "                  padding: const EdgeInsets.only(bottom: 4),\n"
        "                  child: Text('你今年 ${(d['life'] as Map)['age']} 岁'\n"
        "                    '${(d['life'] as Map)['pregnant'] == true ? '　·　身怀六甲（${(d['life'] as Map)['pregnancyDays']} 天）' : ''}',\n"
        "                    style: const TextStyle(color: Color(0xFFDDE3EE), fontSize: 12.5)),\n"
        "                ),\n"
        "              for (final h in ((d['life'] as Map)['house'] as List? ?? []))\n"
        "                Padding(\n"
        "                  padding: const EdgeInsets.symmetric(vertical: 3),\n"
        "                  child: Row(\n"
        "                    children: [\n"
        "                      Expanded(child: Text('${h['name']}  ${h['role'] ?? ''}', style: const TextStyle(color: Color(0xFFCFD6E4), fontSize: 12))),\n"
        "                      Text(\n"
        "                        '${h['age'] != null ? '${h['age']}岁' : ''}${h['pregnant'] == true ? '　有孕 ${h['days']}天' : ''}',\n"
        "                        style: const TextStyle(color: _muted, fontSize: 11.5),\n"
        "                      ),\n"
        "                    ],\n"
        "                  ),\n"
        "                ),\n"
        "            ],\n"
        "          ),\n"
        "        ),\n"
        "      ],\n\n"
        "      _sectionTitle('我的人马'),"
    )
    s = s.replace(anchor, section, 1)
    print('added life section')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
