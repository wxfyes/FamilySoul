import io
# ① 服务端：助手支持看图
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      const body = await parseJsonBody(req, 64 * 1024);
      const replyObj = await assistantService.chat(memberKey, body.text, { newSession: Boolean(body.newSession) });"""
new = """      const body = await parseJsonBody(req, 6 * 1024 * 1024);
      let asked = String(body.text || '');
      // 带了图：先让视觉看一遍，再把"看到的"交给助手，图不落盘
      if (body.imageBase64) {
        try {
          const seen = await visionService.analyzeVisualFrame({ imageBase64: String(body.imageBase64), mimeType: String(body.mimeType || 'image/jpeg') });
          const desc = String(seen?.description || seen?.text || seen?.visualFact || '').trim();
          if (desc) asked = `${asked}\\n（我刚看过一张图：${desc}）`;
        } catch (err) { console.log('[Assistant] 看图失败：', err.message); }
      }
      const replyObj = await assistantService.chat(memberKey, asked, { newSession: Boolean(body.newSession) });"""
if old in s and '我刚看过一张图' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 助手接口支持看图')
