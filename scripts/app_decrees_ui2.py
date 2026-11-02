import io

p = 'mobile/lib/views/my_world_screen.dart'
s = io.open(p, encoding='utf-8-sig').read()

old = "      _sectionTitle('世界动静'),"
new = (
    "      if ((data['decrees'] as List?)?.isNotEmpty == true) ...[\n"
    "        _sectionTitle('朝廷旨意'),\n"
    "        _cardShell(\n"
    "          child: Column(\n"
    "            crossAxisAlignment: CrossAxisAlignment.start,\n"
    "            children: [\n"
    "              for (final d in (data['decrees'] as List))\n"
    "                Padding(\n"
    "                  padding: const EdgeInsets.symmetric(vertical: 4),\n"
    "                  child: Row(\n"
    "                    crossAxisAlignment: CrossAxisAlignment.start,\n"
    "                    children: [\n"
    "                      Text('第${d['day']}日', style: const TextStyle(color: _muted, fontSize: 11.5)),\n"
    "                      const SizedBox(width: 8),\n"
    "                      Expanded(\n"
    "                        child: Text(\n"
    "                          '「${d['text'] ?? ''}」',\n"
    "                          style: const TextStyle(color: Color(0xFFE7D9A8), fontSize: 12.5, height: 1.5),\n"
    "                        ),\n"
    "                      ),\n"
    "                    ],\n"
    "                  ),\n"
    "                ),\n"
    "            ],\n"
    "          ),\n"
    "        ),\n"
    "      ],\n\n"
    "      _sectionTitle('世界动静'),"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched decrees section')
else:
    print('WARN: anchor not found')
io.open(p, 'w', encoding='utf-8').write(s)
