import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 1) 她那侧：没有标签的旁白，统一标【旁白】，别让她自己顶名
old = "    if (this._viewerActorId) {\n      reply = String(reply).replace(/【天道[^】\\n]{0,40}】[:：]?\\s*/g, '');"
new = ("    if (this._viewerActorId) {\n"
       "      reply = String(reply).replace(/【天道[^】\\n]{0,40}】[:：]?\\s*/g, '');\n"
       "      // 没有【人名】开头的叙述，一律算旁白，绝不能显示成她自己说的\n"
       "      if (reply && !/^【[^】\\n]{1,12}】/.test(String(reply).trim())) {\n"
       "        reply = `【旁白】：${String(reply).trim()}`;\n"
       "      }")
if old in s:
    s = s.replace(old, new)
    print('patched: unlabeled -> 旁白')
else:
    print('WARN: member branch head not found')

# 2) 身份卡里加一条：王甯在场必须亲自应声
old2 = "【规矩】只认这五条。"
new2 = "【规矩】只认这五条。王甯在场时，找他他就得自己开口，不许让伙计挡驾。"
if old2 in s:
    s = s.replace(old2, new2)
    print('patched: 王甯在场须应声')
else:
    print('WARN: rule line not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
