import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 彻底不把聊天记录喂给代演：只认账本（承诺/记忆/约定/事件）
start = s.find("            // ③ 他自己账号里跟她的对话（排除别的女人的私话）")
if start < 0:
    print('WARN: history block not found')
else:
    end = s.find("            const facts = [", start)
    if end < 0:
        print('WARN: facts block not found')
    else:
        # 整段替换为"只用账本"的说明
        new = (
            "            // ③ 不再喂聊天记录：聊天会互相带偏，代演只认账本\n"
            "            //    （他记不记得，取决于账本里有没有，而不是刚才聊了什么）\n\n"
        )
        s = s[:start] + new + s[end:]
        print('removed chat history from proxy facts')

# histFacts 不再使用：从 facts 组装里去掉
s = s.replace("              ...histFacts.slice(-6),\n", "")

# 修正 recentLines：也去掉，避免聊天内容混进代演
old_recent = (
    "              said: String(say || '').slice(0, 200),\n"
    "              recent: recentLines,"
)
new_recent = (
    "              said: String(say || '').slice(0, 200),\n"
    "              recent: '', // 不带聊天记录，只按账本回答"
)
if old_recent in s:
    s = s.replace(old_recent, new_recent)
    print('dropped recent lines from proxy')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
