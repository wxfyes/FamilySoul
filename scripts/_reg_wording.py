import io
p = 'src/user-registry.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("// 录入世界账本（先投宿客栈落脚，另有自家小院）", "// 录入世界账本（直接住进自己的小院）")
s = s.replace("落脚临江客栈，天道已建档", "落脚自家小院，天道已建档")
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('清理残留措辞')
