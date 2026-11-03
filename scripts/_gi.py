import io
p = '.gitignore'
s = io.open(p, encoding='utf-8').read()
if 'backups/' not in s:
    s = s.rstrip() + '\n\n# 备份产物不进仓库\nbackups/\n'
    io.open(p, 'w', encoding='utf-8').write(s)
    print('added backups/ to gitignore')
else:
    print('already there')
