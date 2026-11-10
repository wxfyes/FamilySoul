async function healMemory() {
  const token = 'wxf_husband_exclusive_token_2026';
  const r = await fetch('http://192.168.1.254:3088/api/admin/memories?token=' + token);
  const d = await r.json();
  const memories = d.memories || [];
  let changed = 0;

  for (const m of memories) {
    if (m.text && m.text.includes('知县文达荐钱书办做运河酒楼掌柜')) {
      console.log('Found wrong memory:', m.text);
      m.text = '知县文达荐钱书办任鑫雅阁大掌柜兼账房主事，专管歌舞契纸名册与内堂密阁，替相公将鑫雅阁打造成刺探临江消息网、笼络各路达官显贵的清雅会所。';
      changed++;
    }
  }

  console.log('Changed memories count:', changed);
  if (changed > 0) {
    const res = await fetch('http://192.168.1.254:3088/api/admin/memories/replace?token=' + token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memories })
    });
    console.log('Replace result:', await res.json());
  }
}
healMemory();

