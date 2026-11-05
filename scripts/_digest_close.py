import io
p = 'mobile/lib/views/digest_sheet.dart'
s = io.open(p, encoding='utf-8').read()
old = """            Row(children: [
              const Text('今日', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('第${d['day'] ?? '-'}日 ${d['hour'] ?? ''}时',
                  style: const TextStyle(color: Colors.white38, fontSize: 12)),
            ]),"""
new = """            Row(children: [
              const Text('今日', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('第${d['day'] ?? '-'}日 ${d['hour'] ?? ''}时',
                  style: const TextStyle(color: Colors.white38, fontSize: 12)),
              const SizedBox(width: 6),
              InkWell(
                onTap: () => Navigator.pop(context),
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(color: Colors.white10, shape: BoxShape.circle),
                  child: const Icon(Icons.close_rounded, size: 16, color: Colors.white70),
                ),
              ),
            ]),"""
if old in s and 'close_rounded' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('① 今日看板加关闭按钮')
