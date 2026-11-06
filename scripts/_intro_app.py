import io
p = 'mobile/lib/widgets/register_dialog.dart'
s = io.open(p, encoding='utf-8').read()

# ① 加一个"入世背景/用法"首页开关
s = s.replace("  String _gender = 'male';", "  String _gender = 'male';\n  bool _showIntro = true;", 1)

# ② 首页内容：背景 + 使用方法（事实与用法，不讲剧情）
old = """      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
        child: SingleChildScrollView(
          child: Column("""
new = """      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
        child: SingleChildScrollView(
          child: _showIntro ? _buildIntro(isDark) : Column("""
if old in s:
    s = s.replace(old, new, 1)
    print('① 首页切到介绍')

# ③ 插入介绍组件
anchor = "  Widget build(BuildContext context) {"
intro = '''  Widget _buildIntro(bool isDark) {
    const body = TextStyle(fontSize: 12.5, height: 1.5, color: Colors.white70);
    const head = TextStyle(fontSize: 13.5, height: 1.4, color: Color(0xFFE8C87A), fontWeight: FontWeight.w600);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          const Icon(Icons.auto_stories_rounded, color: Color(0xFF8B5CF6), size: 26),
          const SizedBox(width: 8),
          Text('入 世', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: isDark ? Colors.white : const Color(0xFF1E293B))),
        ]),
        const SizedBox(height: 6),
        const Text('临江府 · 运河码头 · 大梁年间', textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, color: Colors.white38)),
        const SizedBox(height: 16),
        const Text('这是什么地方', style: head),
        const SizedBox(height: 6),
        const Text(
          '运河穿城而过，码头上船来船往。城里有县衙、有酒楼茶坊、有货栈米行，也有巷子里的百姓人家。'
          '这里没有给你写好的故事，也没有非走不可的结局——你进来，就是一个活人。',
          style: body,
        ),
        const SizedBox(height: 14),
        const Text('你会拿到什么', style: head),
        const SizedBox(height: 6),
        const Text('一处自己的百姓小院、二两碎银。就这些。\\n'
            '营生、住处、人脉、名声，都要你自己在城里挣。', style: body),
        const SizedBox(height: 14),
        const Text('怎么玩', style: head),
        const SizedBox(height: 6),
        const Text(
          '· 直接说话：跟人对话、打听、议价、吩咐，都是在聊天框里说\\n'
          '· 出门：底部「出门转场」选地方，或点「回家」\\n'
          '· 叫人：话里点名字叫他来、让他走（「让某某回去」）\\n'
          '· 找人办事：说清要办什么，他会记成差事，办成办不成都有回话\\n'
          '· 花钱：涉及银子时，天道会先报价，你确认了才扣\\n'
          '· 世界自己会走：米价会变、人会各自出门、街上有摊子',
          style: body,
        ),
        const SizedBox(height: 14),
        const Text('一条规矩', style: head),
        const SizedBox(height: 6),
        const Text('这里没有剧本，也没有结局。你是天道看着的一个活人，不是被安排的角色。', style: body),
        const SizedBox(height: 18),
        SizedBox(
          height: 44,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF8B5CF6),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => setState(() => _showIntro = false),
            child: const Text('立牒入世', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          ),
        ),
      ],
    );
  }

'''
if '_buildIntro' not in s:
    s = s.replace(anchor, intro + anchor, 1)
    print('② 插入介绍页')
io.open(p, 'w', encoding='utf-8').write(s)
