import io
p = 'mobile/lib/views/army_sheet.dart'
s = io.open(p, encoding='utf-8').read()

# ① _pickCount 支持"每人耗粮"
s = s.replace("""    required double unitPrice,
    double? monthly,""",
"""    required double unitPrice,
    double? grainPer,
    double? monthly,""", 1)

# ② 弹层里显示"需粮 / 府库存粮"，不够就红字提醒
s = s.replace("""            Text('安家银 ${unitPrice.toStringAsFixed(2)} 两 / $unit', style: const TextStyle(color: Colors.white38, fontSize: 12)),""",
"""            Text('安家银 ${unitPrice.toStringAsFixed(2)} 两 / $unit', style: const TextStyle(color: Colors.white38, fontSize: 12)),
            if (grainPer != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '需粮 ${(count * grainPer).toStringAsFixed(1)} 石（府库 ${_grain.toStringAsFixed(1)} 石）',
                  style: TextStyle(
                    color: _grain + 0.001 < count * grainPer ? const Color(0xFFFCA5A5) : Colors.white38,
                    fontSize: 11.5,
                  ),
                ),
              ),
            if (grainPer != null && _grain + 0.001 < count * grainPer)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('存粮不够，先去【购粮】', style: TextStyle(color: Color(0xFFFCA5A5), fontSize: 11.5)),
              ),""", 1)

# ③ 两个招募按钮传上耗粮
s = s.replace("""                    unitPrice: 0.2,
                    monthly: 0.6,""",
"""                    unitPrice: 0.2,
                    grainPer: 0.2,
                    monthly: 0.6,""", 1)
s = s.replace("""                    unitPrice: 0.5,
                    monthly: 0.9,""",
"""                    unitPrice: 0.5,
                    grainPer: 0.3,
                    monthly: 0.9,""", 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('④ 招募弹层显示耗粮与不足提醒')
