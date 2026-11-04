with open('web/dashboard.html.bak-before-sidebar', 'r', encoding='utf-8') as f:
    c = f.read()

import re
matches = re.findall(r'\.off-[^{]+{[^}]+}', c)
for m in matches:
    print(m)

