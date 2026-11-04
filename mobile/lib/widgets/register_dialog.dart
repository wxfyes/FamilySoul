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
  String _originKind = 'scholar';
  bool _submitting = false;
  String _errorMessage = '';

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty || name.length < 2 || name.length > 4) {
      setState(() => _errorMessage = '姓名须为 2~4 个汉字');
      return;
    }
    final age = int.tryParse(_ageController.text.trim()) ?? 0;
    if (age < 14 || age > 60) {
      setState(() => _errorMessage = '年龄须在 14 至 60 岁之间');
      return;
    }

    setState(() {
      _submitting = true;
      _errorMessage = '';
    });

    final res = await widget.apiClient.registerUser(
      name: name,
      gender: _gender,
      age: age,
      originKind: _originKind,
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
                decoration: InputDecoration(
                  labelText: '雅号姓名',
                  hintText: '如：李慕白、沈念',
                  prefixIcon: const Icon(Icons.badge_outlined, size: 20),
                  counterText: '',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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

              // 初入行当
              DropdownButtonFormField<String>(
                value: _originKind,
                decoration: InputDecoration(
                  labelText: '初入出身',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                ),
                items: const [
                  DropdownMenuItem(value: 'scholar', child: Text('求学的生员')),
                  DropdownMenuItem(value: 'merchant', child: Text('行脚小商客')),
                  DropdownMenuItem(value: 'wanderer', child: Text('初来乍到的游侠')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _originKind = val);
                },
              ),
              const SizedBox(height: 10),

              // 落脚说明
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.withValues(alpha: 0.15)),
                ),
                child: const Text(
                  '入世须知：初始携碎银二十两，落脚临江客栈大堂。\n王家产业与正房深闺乃相公私域，闲人莫入。',
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

