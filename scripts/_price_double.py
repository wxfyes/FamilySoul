import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()
# 价格改 double
s = s.replace("    required int unitPrice,\n    int? monthly,", "    required double unitPrice,\n    double? monthly,")
s = s.replace("Text('安家银 $unitPrice 两 / $unit'", "Text('安家银 ${unitPrice.toStringAsFixed(2)} 两 / $unit'")
s = s.replace("Text('共 ${count * unitPrice} 两'", "Text('共 ${(count * unitPrice).toStringAsFixed(2)} 两'")
# 其它调用传 int 的地方改为 double 字面量
s = s.replace("unitPrice: 1,\n                    min: 1,\n                    max: 2000,", "unitPrice: 1.0,\n                    min: 1,\n                    max: 2000,")
s = s.replace("unitPrice: 1,\n                    min: 1,\n                    max: 500,", "unitPrice: 1.0,\n                    min: 1,\n                    max: 500,")
s = s.replace("unitPrice: 2,\n", "unitPrice: 2.0,\n")
s = s.replace("unitPrice: 9,\n", "unitPrice: 9.0,\n")
s = s.replace("unitPrice: 40,\n", "unitPrice: 40.0,\n")
io.open(p, 'w', encoding='utf-8').write(s)
print('价格类型改 double')
