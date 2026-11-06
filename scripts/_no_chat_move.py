import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """      console.log(`\\n[Intent:${intent.id}] actor=${intent.actor} verb=${intent.verb} target="""
new = """      // 铁律：聊天不搬人。真人角色在对话里说"回家""去某处"，只当台词与商议，绝不真移
      try {
        const meI = worldBefore.actors?.[selfId] || worldBefore.actors?.husband;
        const isReal = Boolean(meI && (meI.humanBound || String(meI.id).startsWith('usr_') || meI.id === 'husband'));
        if (isReal && (intent.verb === 'MOVE' || intent.verb === 'ROOM')) {
          console.log(`[Chat] 台词不搬人：${meI.name || selfId} 说的「${String(say).slice(0, 18)}」不触发位移`);
          intent = { ...intent, verb: 'TALK', target: null, params: {} };
        }
      } catch { /* 忽略 */ }
      console.log(`\\n[Intent:${intent.id}] actor=${intent.actor} verb=${intent.verb} target="""
if old in s and '台词不搬人' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 聊天不再搬人')
