import io, re
src = io.open('scripts/regress.py', encoding='utf-8').read()
head = src.split("HEAD = r'''")[1].split("'''")[0]
tail = src.split("TAIL = r'''")[1].split("'''")[0]
i = src.find("问不在场的人")
seg = src[i:i+900]
# 取三引号内的脚本
m = re.search(r'r"""(.*?)"""', seg, re.S)
body = m.group(1) if m else ''
io.open('.tmp_case2.mjs','w',encoding='utf-8').write(head + body + tail)
print('generated')
