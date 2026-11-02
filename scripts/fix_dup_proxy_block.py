import io

p = 'src/pet-service.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')

# 删除 1391-1405（1-based）那段重复 + 残留括号
start = None
for i in range(1385, 1400):
    if lines[i].strip() == '// 他自己的账号跟她聊过的事，也算他的记忆' and 'hisHist' in lines[i+2]:
        # 第二个出现的位置
        if start is None:
            first = i
        else:
            start = i
            break
if start is None:
    print('WARN: duplicate block not found')
else:
    end = None
    for j in range(start, start + 30):
        if lines[j].strip() == '} catch { /* 忽略 */ }':
            end = j
            break
    if end is None:
        print('WARN: end not found')
    else:
        # 一起删掉后面残留的 } 与 } catch
        k = end + 1
        while k < len(lines) and lines[k].strip() in ('}', '} catch { /* 忽略 */ }'):
            k += 1
        lines = lines[:start] + lines[k:]
        print('removed duplicate block and stray braces')

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('ok')
