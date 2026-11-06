import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../views/settings_screen.dart';

class RegisterDialog extends StatefulWidget {
  final SurfCoreApiClient apiClient;
  final Function(String token, String actorId, String name) onRegistered;

  const RegisterDialog({
    super.key,
    required this.apiClient,
    required this.onRegistered,
  });

  @override
  State<RegisterDialog> createState() => _RegisterDialogState();
}

class _RegisterDialogState extends State<RegisterDialog> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _ageController = TextEditingController(text: '20');
  String _gender = 'male';
    bool _submitting = false;
  String _errorMessage = '';

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty || name.length < 2 || name.length > 4) {
      setState(() => _errorMessage = '姓名须为 2~4 个汉字');
      return;
    }
    const functionChars = '只会那个上来什么不是就可以已经的着了和与我你他她它们这没有在到把被让给对从向为因所但而或且如若虽然很太更最都也还又再才';
    if (name.characters.every((ch) => functionChars.contains(ch))) {
      setState(() => _errorMessage = '此名不似人名，请取一个有姓氏或雅号的名字');
      return;
    }
    final age = int.tryParse(_ageController.text.trim()) ?? 0;
    if (age < 14 || age > 60) {
      setState(() => _errorMessage = '年龄须在 14 至 60 岁之间');
      return;
    }

    // 名字不可逆：让他亲眼确认一遍再进去
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('确认入世'),
        content: Text('你将以「$name」之名入世，年 $age 岁。\n此名不可再改（日后欲改须寻天道）。'),
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
    });

    final res = await widget.apiClient.registerUser(
      name: name,
      gender: _gender,
      age: age,
    );

    if (!mounted) return;

    if (res['ok'] == true && res['token'] != null) {
      Navigator.pop(context);
      widget.onRegistered(
        res['token'].toString(),
        res['actorId'].toString(),
        res['name'].toString(),
      );
    } else {
      setState(() {
        _submitting = false;
        _errorMessage = res['error']?.toString() ?? '入世建档失败，请重试';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.auto_stories_rounded, color: Color(0xFF8B5CF6), size: 26),
                  const SizedBox(width: 8),
                  Text(
                    '初入临江 · 入世立牒',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: isDark ? Colors.white : const Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                '天地浩渺，请立下你的江南户牒，踏入宿命乾坤',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 18),

              // 姓名
              TextField(
                controller: _nameController,
                maxLength: 4,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  labelText: '雅号姓名',
                  hintText: '如：李慕白、沈念',
                  prefixIcon: const Icon(Icons.badge_outlined, size: 20),
                  counterText: '',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
              ),
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

              // 年龄与性别
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ageController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: '春秋岁数',
                        hintText: '14~60',
                        prefixIcon: const Icon(Icons.cake_outlined, size: 20),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      value: _gender,
                      decoration: InputDecoration(
                        labelText: '性别',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'male', child: Text('男')),
                        DropdownMenuItem(value: 'female', child: Text('女')),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _gender = val);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),


              // 落脚说明
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.withValues(alpha: 0.15)),
                ),
                child: const Text(
                  '入世须知：身上只有二两碎银，落脚临江客栈。\n住处、营生、人脉，都要自己在城里挣。\n王家产业与正房深闺乃相公私域，闲人莫入。',
                  style: TextStyle(fontSize: 11, color: Colors.grey, height: 1.35),
                ),
              ),

              if (_errorMessage.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  _errorMessage,
                  style: const TextStyle(fontSize: 12, color: Colors.red),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 16),

              // 入世按钮
              ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text(
                        '立牒入世',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
              ),
              const SizedBox(height: 6),
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
                },
                child: const Text(
                  '已有通关令印？前往设置填入令牌',
                  style: TextStyle(fontSize: 12, color: Color(0xFF8B5CF6)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

