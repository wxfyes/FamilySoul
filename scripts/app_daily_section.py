import io

p = 'mobile/lib/views/my_world_screen.dart'
s = io.open(p, encoding='utf-8').read()

# ① 取 daily
old = """    final news = (d['news'] as List?) ?? const [];"""
new = """    final news = (d['news'] as List?) ?? const [];
    final daily = (d['daily'] as List?) ?? const [];"""
if old in s and 'daily' not in s.split('final clues')[0]:
    s = s.replace(old, new, 1)
    print('① 取 daily')

# ② 在"家底"之前插一节：各人今日动向
anchor = """      // 家底
      _sectionTitle('家底'),"""
block = """      // 各人今日动向
      if (daily.isNotEmpty) ...[
        _sectionTitle('各人今日动向'),
        _cardShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final g in daily.cast<Map>())
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text('${g['name']}',
                              style: const TextStyle(color: Color(0xFFE7ECF5), fontSize: 13.5, fontWeight: FontWeight.w600)),
                          const SizedBox(width: 6),
                          if ('${g['place'] ?? ''}'.isNotEmpty)
                            Text('在${g['place']}',
                                style: const TextStyle(color: _muted, fontSize: 11.5)),
                        ],
                      ),
                      for (final line in ((g['lines'] as List?) ?? const []))
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text('· $line',
                              style: const TextStyle(color: Color(0xFFB6BFD0), fontSize: 12.5, height: 1.35)),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],

      // 家底
      _sectionTitle('家底'),"""
if anchor in s and '各人今日动向' not in s:
    s = s.replace(anchor, block, 1)
    print('② 插入各人动向一节')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
