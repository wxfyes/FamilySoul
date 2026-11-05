import io
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
# 位置自愈：只在"真的修了人"时打一行汇总，不再逐人刷屏
old = """          a.location = a.home && world.places?.[a.home] ? a.home : 'street';
          console.log(`[State] ${a.name} 位置自愈归位 → ${a.location}`);"""
new = """          a.location = a.home && world.places?.[a.home] ? a.home : 'street';
          fixedGhosts += 1;"""
if old in s:
    s = s.replace(old, new, 1)
    s = s.replace("""  // 强力清除所有 clinic / workshop 等英文幽灵地名，全员位置自愈归位（60 秒一次，别每读档都刷）""",
"""  let fixedGhosts = 0;
  // 强力清除所有 clinic / workshop 等英文幽灵地名，全员位置自愈归位（60 秒一次，别每读档都刷）""", 1)
    s = s.replace("""  } catch (e) { console.warn('[State] 幽灵地点清理异常:', e.message); }""",
"""    if (fixedGhosts) console.log(`[State] 位置自愈：${fixedGhosts} 人归位`);
  } catch (e) { console.warn('[State] 幽灵地点清理异常:', e.message); }""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 位置自愈日志改成一行汇总')
