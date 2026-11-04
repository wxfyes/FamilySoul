import re

with open('web/dashboard.html.bak-before-sidebar', 'r', encoding='utf-8') as f:
    c = f.read()

missing_ids = ['c-avg', 'c-note', 'a-silver', 'a-income', 'a-props', 'diag', 'who', 'whoQ']
res = []
for mid in missing_ids:
    idx = c.find(f'id="{mid}"')
    if idx == -1:
        idx = c.find(f"id='{mid}'")
    if idx != -1:
        start = max(0, idx - 100)
        end = min(len(c), idx + 200)
        res.append(f"=== {mid} ===\n{c[start:end]}\n")
    else:
        res.append(f"=== {mid} NOT FOUND ===\n")

with open('scripts/bak_ids_result.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(res))
print("Wrote results to scripts/bak_ids_result.txt")
