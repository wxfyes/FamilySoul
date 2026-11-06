import io
p = 'mobile/lib/widgets/register_dialog.dart'
s = io.open(p, encoding='utf-8').read()
old = """                items: const [
                  DropdownMenuItem(value: 'scholar', child: Text('求学的生员')),
                  DropdownMenuItem(value: 'merchant', child: Text('行脚小商客')),
                  DropdownMenuItem(value: 'wanderer', child: Text('初来乍到的游侠')),
                ],"""
new = """                items: const [
                  DropdownMenuItem(value: 'scholar', child: Text('求学的生员')),
                  DropdownMenuItem(value: 'merchant', child: Text('行脚小商客')),
                  DropdownMenuItem(value: 'wanderer', child: Text('初来乍到的游侠')),
                  DropdownMenuItem(value: 'farmer', child: Text('城郊农户')),
                  DropdownMenuItem(value: 'artisan', child: Text('手艺匠人（木匠/铁匠）')),
                  DropdownMenuItem(value: 'weaver', child: Text('绣坊绣娘')),
                  DropdownMenuItem(value: 'cook', child: Text('酒楼厨娘')),
                  DropdownMenuItem(value: 'singer', child: Text('茶坊唱曲')),
                  DropdownMenuItem(value: 'player', child: Text('戏班伶人')),
                  DropdownMenuItem(value: 'servant', child: Text('大户仆役')),
                  DropdownMenuItem(value: 'peddler', child: Text('走街货郎')),
                  DropdownMenuItem(value: 'boatman', child: Text('运河船工')),
                  DropdownMenuItem(value: 'hunter', child: Text('山中猎户')),
                  DropdownMenuItem(value: 'guard', child: Text('镖行趟子手')),
                  DropdownMenuItem(value: 'medic', child: Text('游方郎中')),
                  DropdownMenuItem(value: 'teacher', child: Text('私塾先生')),
                  DropdownMenuItem(value: 'clerk', child: Text('县衙书办')),
                  DropdownMenuItem(value: 'priest', child: Text('庵堂道姑')),
                ],"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('② 客户端出身 18 种')
