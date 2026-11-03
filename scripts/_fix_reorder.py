import io, re
p = 'scripts/reorder_dashboard.py'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""    title = ''
    for j in range(s, min(s + 6, e)):""", """    title = ''
    if 'morning-banner' in lines[s]:
        title = '__BANNER__'
    for j in range(s, min(s + 6, e)):""")
s = s.replace("""def rank(title):
    for i, k in enumerate(ORDER):""", """def rank(title):
    if title == '__BANNER__':
        return -1
    for i, k in enumerate(ORDER):""")
s = s.replace("""    print(f'  {i:2d}. {b["title"][:28]}')""", """    print('  %2d. %s' % (i, b['title'][:28]))""")
io.open(p, 'w', encoding='utf-8').write(s)
print('script patched')
