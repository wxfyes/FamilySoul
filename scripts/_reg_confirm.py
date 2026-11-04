import io
p = 'mobile/lib/widgets/register_dialog.dart'
s = io.open(p, encoding='utf-8').read()

# ① 名字输入：实时刷新预览
old = """              TextField(
                controller: _nameController,
                maxLength: 4,"""
new = """              TextField(
                controller: _nameController,
                maxLength: 4,
                onChanged: (_) => setState(() {}),"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 输入实时刷新')

# ② 预览行（就在输入框下面）
old2 = """              ),
              const SizedBox(height: 12),

              // 年龄与性别"""
new2 = """              ),
              if (_nameController.text.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    '你将名为「${_nameController.text.trim()}」',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ),
              const SizedBox(height: 12),

              // 年龄与性别"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 加名字预览')

# ③ 提交前二次确认
old3 = """    setState(() {
      _submitting = true;
      _errorMessage = '';
    });"""
new3 = """    // 名字不可逆：让他亲眼确认一遍再进去
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认入世'),
        content: Text('你将以「$name」之名入世，年 $age 岁。\\n此名不可再改（日后欲改须寻天道）。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('返回重填')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('就是他')),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!mounted) return;

    setState(() {
      _submitting = true;
      _errorMessage = '';
    });"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 加二次确认')
io.open(p, 'w', encoding='utf-8').write(s)
