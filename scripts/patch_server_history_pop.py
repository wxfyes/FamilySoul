with open('src/server.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """    // 9.32 重置某个世界人物的线 POST /api/admin/actor/reset"""

replacement = """    // 9.31b 弹出某个成员最后 N 条聊天历史 POST /api/admin/history/pop {member, count}
    if (req.method === 'POST' && pathname === '/api/admin/history/pop') {
      try {
        const body = await parseJsonBody(req, 64 * 1024);
        const member = String(body.member || 'husband').trim();
        const count = Math.max(1, Number(body.count) || 2);
        const cur = petService.readHistory(member);
        cur.messages = (cur.messages || []).slice(0, -count);
        petService.saveHistory(member, cur);
        console.log(`[History] 已弹出 ${member} 最后 ${count} 条历史（剩余 ${cur.messages.length} 条）`);
        return sendJson(res, 200, { ok: true, member, popped: count, remaining: cur.messages.length });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // 9.32 重置某个世界人物的线 POST /api/admin/actor/reset"""

if target in text:
    text = text.replace(target, replacement)
    with open('src/server.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully added history/pop to server.js!")
else:
    print("Target not found in server.js")

