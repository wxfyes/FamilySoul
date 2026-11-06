import io
p = 'mobile/lib/views/assistant_view.dart'
s = io.open(p, encoding='utf-8').read()

# ① 输入区加：话筒（语音转文字）、相册（看图）、发送
old = """                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send_rounded, color: Color(0xFF3B82F6)),
                  onPressed: _sendMessage,
                ),"""
new = """                IconButton(
                  tooltip: '按住说话',
                  icon: Icon(_listening ? Icons.mic_rounded : Icons.mic_none_rounded,
                      color: _listening ? const Color(0xFFEF4444) : Colors.grey),
                  onPressed: _toggleMic,
                ),
                IconButton(
                  tooltip: '发一张图给助手看',
                  icon: const Icon(Icons.add_photo_alternate_outlined, color: Colors.grey),
                  onPressed: _pickImage,
                ),
                IconButton(
                  icon: const Icon(Icons.send_rounded, color: Color(0xFF3B82F6)),
                  onPressed: _sendMessage,
                ),"""
if old in s and '_toggleMic' not in s:
    s = s.replace(old, new, 1)
    print('① 输入区加话筒/相册')

# ② 状态与动作
anchor = "  Future<void> _sendMessage() async {"
add = """  bool _listening = false;
  final SpeechToText _speech = SpeechToText();
  String? _imageBase64;
  String? _imageMime;

  Future<void> _toggleMic() async {
    try {
      if (_listening) {
        await _speech.stop();
        setState(() => _listening = false);
        return;
      }
      final ok = await _speech.initialize();
      if (!ok) return;
      setState(() => _listening = true);
      await _speech.listen(
        localeId: 'zh_CN',
        onResult: (r) {
          if (r.recognizedWords.isNotEmpty) {
            _inputController.text = r.recognizedWords;
            _inputController.selection = TextSelection.fromPosition(TextPosition(offset: _inputController.text.length));
          }
        },
      );
    } catch (_) {
      if (mounted) setState(() => _listening = false);
    }
  }

  Future<void> _pickImage() async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1280, imageQuality: 82);
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      setState(() {
        _imageBase64 = base64Encode(bytes);
        _imageMime = 'image/jpeg';
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('已选好一张图，发出去我看看'),
          duration: Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
        ));
      }
    } catch (_) {}
  }

""" + anchor
if '_toggleMic' in s and 'Future<void> _toggleMic' not in s:
    s = s.replace(anchor, add, 1)
    print('② 加语音与选图逻辑')

# ③ 发送时带上图
s = s.replace("    final reply = await widget.apiClient.askAssistant(text);",
              "    final reply = await widget.apiClient.askAssistant(text, imageBase64: _imageBase64, mimeType: _imageMime);", 1)
s = s.replace("      _inputController.clear();",
              "      _inputController.clear();\n      _imageBase64 = null;\n      _imageMime = null;", 1)

# ④ 依赖
if "package:speech_to_text" not in s:
    s = s.replace("import 'package:flutter/material.dart';",
                  "import 'package:flutter/material.dart';\nimport 'dart:convert';\nimport 'package:image_picker/image_picker.dart';\nimport 'package:speech_to_text/speech_to_text.dart';", 1)
io.open(p, 'w', encoding='utf-8').write(s)
