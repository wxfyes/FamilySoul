import io, re
src = io.open('scripts/regress.py', encoding='utf-8').read()
head = src.split("HEAD = r'''")[1].split("'''")[0]
tail = src.split("TAIL = r'''")[1].split("'''")[0]
i = src.find("隔空找王甯仍能应声")
seg = src[i:i+600]
m = re.search(r'r"""(.*?)"""', seg, re.S) or re.search(r"r'''(.*?)'''", seg, re.S)
io.open('.tmp_case.mjs','w',encoding='utf-8').write(head + (m.group(1) if m else '') + tail)
print('ok')
