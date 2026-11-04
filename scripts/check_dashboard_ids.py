import re

with open('web/dashboard.html', 'r', encoding='utf-8') as f:
    c = f.read()

# 找出所有的 id="..."
html_ids = set(re.findall(r'id=["\']([^"\']+)["\']', c))

# 找出所有的 $('...')
all_dollar = re.findall(r"\$\(['\"]([^'\"]+)['\"]\)", c)
print(f"Total $('...') calls: {len(all_dollar)}")

missing = {}
for did in set(all_dollar):
    if did not in html_ids:
        # 看看在哪些行被调用
        lines = [i+1 for i, line in enumerate(c.splitlines()) if f"$('{did}')" in line or f'$("{did}")' in line]
        missing[did] = lines

print("Missing IDs count:", len(missing))
for k, v in sorted(missing.items()):
    print(f"  Missing: {k} at lines {v}")

