import re, io
s = io.open('web/dashboard.html', encoding='utf-8').read()
blocks = re.findall(r'<script[^>]*>(.*?)</script>', s, re.S)
io.open('scripts/_dash_check.js','w',encoding='utf-8').write('\n'.join(blocks))
print('blocks', len(blocks))
