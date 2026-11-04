import re

with open('web/dashboard.html.bak-before-sidebar', 'r', encoding='utf-8') as f:
    c = f.read()

sections = re.findall(r'<section class=["\']card[^"\']*["\'][^>]*>(.*?)</section>', c, re.DOTALL)
lines = [f"Total cards in bak: {len(sections)}"]
for s in sections:
    h2 = re.search(r'<h2>(.*?)</h2>', s)
    h2_text = h2.group(1) if h2 else 'No H2'
    mid = re.search(r'id=["\']([^"\']+)["\']', s)
    mid_text = mid.group(1) if mid else 'No ID'
    lines.append(f"Card ID: {mid_text} | H2: {h2_text}")

with open('scripts/bak_cards_list.txt', 'w', encoding='utf-8') as out:
    out.write('\n'.join(lines))
print("Wrote bak_cards_list.txt")
