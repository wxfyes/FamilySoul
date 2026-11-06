import io
p = 'mobile/lib/widgets/register_dialog.dart'
lines = io.open(p, encoding='utf-8').read().split('\n')
start = next(i for i, l in enumerate(lines) if '// 初入行当' in l)
end = next(i for i, l in enumerate(lines) if 'if (val != null) setState(() => _originKind = val);' in l)
# 删除 start 到 end+3（含 "}," ")," 行）
del lines[start:end+4]
s = '\n'.join(lines)
s = s.replace("String _originKind = 'scholar';\n", "", 1)
s = s.replace("      originKind: _originKind,\n", "", 1)
s = s.replace("'入世须知：初始携碎银二十两，落脚临江客栈大堂。\\n王家产业与正房深闺乃相公私域，闲人莫入。'",
              "'入世须知：身上只有二两碎银，落脚临江客栈。\\n住处、营生、人脉，都要自己在城里挣。\\n王家产业与正房深闺乃相公私域，闲人莫入。'")
io.open(p, 'w', encoding='utf-8').write(s)
print('删掉出身块（精确到 onChanged 结束）')
