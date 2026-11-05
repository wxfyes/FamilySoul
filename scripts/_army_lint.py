import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("import 'package:flutter/material.dart';\nimport 'package:flutter/services.dart';\n", "import 'package:flutter/material.dart';\n")
s = s.replace("Text('${unitPrice} 两 / $unit'", "Text('$unitPrice 两 / $unit'")
io.open(p, 'w', encoding='utf-8').write(s)
print('清理告警')
