import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()

# ① 弹层：支持 min/max 单位价、显示"安家银 + 月饷"两行说明
old_hint = """            Text('$unitPrice 两 / $unit', style: const TextStyle(color: Colors.white38, fontSize: 12)),"""
new_hint = """            Text('安家银 $unitPrice 两 / $unit', style: const TextStyle(color: Colors.white38, fontSize: 12)),
            if (monthly != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('月饷 $monthly 两 / $unit / 月（每月初一放饷）',
                    style: const TextStyle(color: Color(0xFFE0B252), fontSize: 11.5)),
              ),
            if (note != null)
              Padding(
                padding: const EdgeInsets.only(top: 6, left: 10, right: 10),
                child: Text(note, textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white30, fontSize: 11)),
              ),"""
if old_hint in s:
    s = s.replace(old_hint, new_hint, 1)
    print('① 弹层加安家银/月饷/说明')

# ② _pickCount 增加可选参数
old_sig = """    required int unitPrice,
    required int min,
    required int max,"""
new_sig = """    required int unitPrice,
    int? monthly,
    String? note,
    required int min,
    required int max,"""
if old_sig in s:
    s = s.replace(old_sig, new_sig, 1)
    print('② _pickCount 支持 monthly/note')

# ③ 家丁/护院：安家银改 0.2 / 0.5，并带月饷与说明
old_guard = """                    title: '招募家丁',
                    unit: '人',
                    unitPrice: 1,
                    min: 1,
                    max: 500,
                    presets: const [5, 10, 20, 50],
                    action: 'call',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'guard'},"""
new_guard = """                    title: '招募家丁',
                    unit: '人',
                    unitPrice: 0.2,
                    monthly: 0.6,
                    note: '一呼百应：来投多少看你的名声与这座城的日子，喊 50 人未必来 50 个。',
                    min: 1,
                    max: 500,
                    presets: const [5, 10, 20, 50],
                    action: 'call',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'guard'},"""
if old_guard in s:
    s = s.replace(old_guard, new_guard, 1)
    print('③ 家丁 0.2 两/人 + 月饷 0.6')

old_ret = """                    title: '招募护院',
                    unit: '人',
                    unitPrice: 3,
                    min: 1,
                    max: 200,
                    presets: const [2, 5, 10, 20],
                    action: 'call',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'retainer'},"""
new_ret = """                    title: '招募护院',
                    unit: '人',
                    unitPrice: 0.5,
                    monthly: 0.9,
                    note: '护院是精壮武师，安家银比家丁贵些，月饷 0.9 两；一样是看名声与民心来人。',
                    min: 1,
                    max: 200,
                    presets: const [2, 5, 10, 20],
                    action: 'call',
                    extra: {'city': cities.isNotEmpty ? cities.first.key : '', 'kind': 'retainer'},"""
if old_ret in s:
    s = s.replace(old_ret, new_ret, 1)
    print('④ 护院 0.5 两/人 + 月饷 0.9')

# ⑤ 按钮上直接标安家银
s = s.replace("label: '招募家丁',", "label: '招募家丁 ·安家0.2两',")
s = s.replace("label: '招募护院',", "label: '招募护院 ·安家0.5两',")
print('⑤ 按钮标价')
io.open(p, 'w', encoding='utf-8').write(s)
