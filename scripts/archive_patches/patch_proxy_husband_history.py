import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 在 facts 收集之后，补上"他自己账号里跟她的对话"
anchor = "            } catch { /* 忽略 */ }\n"
idx = s.find("            try {\n              const evFile = path.join(this.dataDir, 'world', 'events.jsonl');")
if idx < 0:
    print('WARN: events block not found')
else:
    # 找到该 try 的结束（下一个 "} catch { /* 忽略 */ }"）
    end = s.find("            } catch { /* 忽略 */ }\n", idx)
    if end < 0:
        print('WARN: events block end not found')
    else:
        end += len("            } catch { /* 忽略 */ }\n")
        block = (
            "            // 他自己的账号跟她聊过的事，也算他的记忆\n"
            "            try {\n"
            "              const hisHist = this.readHistory('husband');\n"
            "              const hisLines = (hisHist.messages || [])\n"
            "                .filter((m) => {\n"
            "                  const t = String(m?.text || '');\n"
            "                  return /(雅阁|紫嫣|文霞)/.test(t);\n"
            "                })\n"
            "                .slice(-8)\n"
            "                .map((m) => String(m.text).slice(0, 80));\n"
            "              for (const l of hisLines) facts.push(l);\n"
            "            } catch { /* 忽略 */ }\n"
        )
        s = s[:end] + block + s[end:]
        print('added husband history to proxy facts')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
