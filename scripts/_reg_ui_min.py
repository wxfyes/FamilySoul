import io
p = 'mobile/lib/widgets/register_dialog.dart'
s = io.open(p, encoding='utf-8').read()

# ① 删掉"初入出身"整块
start = s.find("              // 初入行当")
end = s.find("              const SizedBox(height: 10),", start)
if start > 0 and end > 0:
    s = s[:start] + s[end:]
    print('① 删掉出身下拉')

# ② 提交不再带 originKind（保留字段给服务端兼容）
s = s.replace("      originKind: _originKind,\n", "", 1)
s = s.replace("String _originKind = 'youngMan';\n", "", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('② 提交去掉出身')
