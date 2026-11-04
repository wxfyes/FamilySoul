import re

with open('web/dashboard.html', 'r', encoding='utf-8') as f:
    c = f.read()

m = re.search(r'<script>(.*?)</script>', c, re.DOTALL)
if m:
    with open('scripts/test_dashboard.js', 'w', encoding='utf-8') as out:
        mock = """// mock browser
global.document = { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} };
global.localStorage = { getItem: () => '', setItem: () => {} };
global.location = { search: '', hash: '' };
global.window = { innerWidth: 1200 };
"""
        out.write(mock + m.group(1))
    print("Extracted test_dashboard.js")

