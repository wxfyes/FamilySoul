import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()
old = """    final ok = r?['ok'] == true;
    final msg = ok ? okPrefix : (r?['error']?.toString() ?? '没办成');"""
new = """    final ok = r?['ok'] == true;
    // 招募是"一呼百应"：报实际来投人数，而不是报你喊了多少
    String msg;
    if (!ok) {
      msg = r?['error']?.toString() ?? '没办成';
    } else if (r?['came'] != null) {
      final came = r?['came'];
      final asked = r?['asked'];
      final pay = r?['monthlyPay'];
      msg = '一呼百应：喊 $asked 人，来投 $came 人'
          '${pay != null ? '（月饷 $pay 两/月）' : ''}';
    } else {
      msg = okPrefix;
    }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('招募结果改报实际来投人数')
