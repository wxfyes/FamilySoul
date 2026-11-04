import io

p = 'mobile/lib/views/out_and_about_sheet.dart'
d = io.open(p, encoding='utf-8').read()

old = """      children: todos.map((x) {
        final isApt = (x['kind'] ?? '') == '约定';
        return _row(
          title: '${x['kind']} · ${x['when'] ?? ''} ${x['who'] ?? ''}',
          subtitle: (x['text'] ?? '').toString(),
          action: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isApt)
                TextButton(
                  onPressed: () => _run(() => widget.api.todoAction((x['id'] ?? '').toString(), 'go'), '（你去赴约了。）'),
                  child: const Text('赴约'),
                ),
              TextButton(
                onPressed: () => _run(() => widget.api.todoAction((x['id'] ?? '').toString(), 'drop'), '（这件事先搁下了。）'),
                child: const Text('取消', style: TextStyle(color: Colors.white38)),
              ),
            ],
          ),
        );
      }).toList(),"""
new = """      children: todos.map((x) {
        final id = (x['id'] ?? '').toString();
        final place = (x['placeName'] ?? '').toString();
        final overdue = x['overdue'] == true;
        final sub = [
          if (place.isNotEmpty) '在$place',
          (x['text'] ?? '').toString(),
          if (overdue) '（已过期）',
        ].where((e) => e.isNotEmpty).join(' · ');
        return _row(
          title: '${x['kind']} · ${x['when'] ?? ''} ${x['who'] ?? ''}',
          subtitle: sub,
          action: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextButton(
                onPressed: () => _run(() => _todo(id, 'do'), '（办了。）'),
                child: const Text('去做'),
              ),
              TextButton(
                onPressed: () => _run(() => _todo(id, 'later'), '（改天了。）'),
                child: const Text('改天', style: TextStyle(color: Colors.white54)),
              ),
              TextButton(
                onPressed: () => _run(() => _todo(id, 'drop'), '（推了。）'),
                child: const Text('推掉', style: TextStyle(color: Colors.white38)),
              ),
            ],
          ),
        );
      }).toList(),"""
if old in d:
    d = d.replace(old, new, 1)
    print('① 待办改成 去做/改天/推掉')
else:
    print('WARN: 待办渲染段没找到')

# 加 _todo 方法（接住服务端返回的整行）
if 'Future<bool> _todo(' not in d:
    anchor = "  /// 去某地：把服务端的\"到达提示\"接住"
    add = """  /// 行程动作：去做 / 改天 / 推掉
  Future<bool> _todo(String id, String action) async {
    final ok = await widget.api.todoAction(id, action);
    return ok;
  }

"""
    if anchor in d:
        d = d.replace(anchor, add + anchor, 1)
        print('② 加 _todo')
    else:
        d = d.replace("  Future<void> _run(", add + "  Future<void> _run(", 1)
        print('② 加 _todo（备用锚点）')

io.open(p, 'w', encoding='utf-8').write(d)
print('done')
