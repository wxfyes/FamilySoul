import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        if (poolR.length === 0) {"
new = (
    "        console.log(`[Memory] 旧事检查 ask=${askP2} fab=${looksFabricated} pool=${poolR.length} speakers=${namesR.join('、')}`);\n"
    "        if (poolR.length === 0) {"
)
if old in s and '旧事检查' not in s:
    s = s.replace(old, new, 1)
    print('added memory debug log')

old2 = "    } catch { /* 忽略 */ }\n\n    // 最后一道：所有后处理改的是 reply"
new2 = "    } catch (e) { console.warn('[Memory] 重写失败：', e.message); }\n\n    // 最后一道：所有后处理改的是 reply"
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('exposed rewrite errors')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
