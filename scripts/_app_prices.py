import io

# App 家兵面板：价格按行情，加"家丁/护院"两种募法
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()

# 募兵 → 家丁（1.2 两）/ 护院（3 两）
old = """                _pill(
                  icon: Icons.groups_rounded,
                  label: '募兵',
                  color: _accent,
                  onTap: () => _pickCount(
                    title: '募兵',
                    unit: '人',
                    unitPrice: 12,
                    min: 1,
                    max: 500,
                    presets: const [10, 30, 50, 100],
                    action: 'recruit',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : ''},
                  ),
                ),"""
new = """                _pill(
                  icon: Icons.groups_rounded,
                  label: '募家丁',
                  color: _accent,
                  onTap: () => _pickCount(
                    title: '募家丁',
                    unit: '人',
                    unitPrice: 1,
                    min: 1,
                    max: 500,
                    presets: const [5, 10, 20, 50],
                    action: 'recruit',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'guard', 'unitCost': 1.2},
                  ),
                ),
                _pill(
                  icon: Icons.shield_moon_rounded,
                  label: '募护院',
                  color: Colors.purpleAccent,
                  onTap: () => _pickCount(
                    title: '募护院',
                    unit: '人',
                    unitPrice: 3,
                    min: 1,
                    max: 200,
                    presets: const [2, 5, 10, 20],
                    action: 'recruit',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'retainer', 'unitCost': 3},
                  ),
                ),"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 家丁/护院两个募法')

# 购粮/军械价格改成行情
s = s.replace("unitPrice: 1,\n                    min: 1,\n                    max: 2000,\n                    presets: const [50, 100, 300],",
              "unitPrice: 1,\n                    min: 1,\n                    max: 2000,\n                    presets: const [50, 100, 300],")
s = s.replace("title: '买兵器',\n                    unit: '件',\n                    unitPrice: 3,", "title: '买兵器',\n                    unit: '件',\n                    unitPrice: 1,")
s = s.replace("title: '买铠甲',\n                    unit: '件',\n                    unitPrice: 5,", "title: '买铠甲',\n                    unit: '件',\n                    unitPrice: 2,")
s = s.replace("title: '买战马',\n                    unit: '匹',\n                    unitPrice: 20,", "title: '买战马',\n                    unit: '匹',\n                    unitPrice: 9,")
s = s.replace("title: '买攻城器械',\n                    unit: '架',\n                    unitPrice: 300,", "title: '买攻城器械',\n                    unit: '架',\n                    unitPrice: 40,")
io.open(p, 'w', encoding='utf-8').write(s)
print('② 军械价改行情')
