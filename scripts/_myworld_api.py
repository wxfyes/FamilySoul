import io
p = 'mobile/lib/views/my_world_screen.dart'
s = io.open(p, encoding='utf-8').read()
s = s.replace("final r = await api.householdPay();", "final r = await widget.api.householdPay();")
io.open(p, 'w', encoding='utf-8').write(s)
print('改用 widget.api')
