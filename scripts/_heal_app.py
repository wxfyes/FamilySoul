import io
# ① 去掉 heal.js 里"强制确权"（无主产业一律判给王甯 —— 会吞掉别人的店）
p = 'src/world/heal.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find("  // ⑬ 确权王家名下所有产业")
end = s.find("  return fixes;", start)
if start > 0 and end > start:
    s = s[:start] + "  // （原「强制确权」已删除：无主产业不该被吞给任何人；归属在创建产业时确定）\n" + s[end:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 删除 heal 里的强制确权')

# ② App「我的世界」显示婚姻与住处
p2 = 'mobile/lib/views/my_world_screen.dart'
d = io.open(p2, encoding='utf-8').read()
old = """    final props = (assets['properties'] as List?) ?? const [];"""
new = """    final props = (assets['properties'] as List?) ?? const [];
    final married = (self['married'] as String?) ?? '';
    final spouseName = (self['spouseName'] as String?) ?? '';
    final residence = (self['residence'] as String?) ?? '';"""
if old in d and 'spouseName' not in d:
    d = d.replace(old, new, 1)
    print('② App 读取婚姻/住处')

# 在"我这一日"之前插入两行信息
anchor = "      // 我这一日（只有自己的事）"
block = """      // 名分与住处
      _sectionTitle('名分与住处'),
      _cardShell(
        child: Column(
          children: [
            _kv('婚姻', spouseName.isNotEmpty ? '$married · 配偶「$spouseName」' : (married.isEmpty ? '未婚' : married)),
            _kv('住处', residence.isEmpty ? '尚无定所' : residence),
          ],
        ),
      ),

""" + anchor
if anchor in d and '名分与住处' not in d:
    d = d.replace(anchor, block, 1)
    print('③ App 显示婚姻/住处')
io.open(p2, 'w', encoding='utf-8').write(d)
