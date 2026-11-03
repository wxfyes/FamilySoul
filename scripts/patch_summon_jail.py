with open('src/world/summon.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

# 1. 修复 wantName 匹配
old_exists = "    const exists = Object.entries(world.places || {}).find(([, pl]) => String(pl?.name || '').replace(/·.*$/, '').includes(wantName));"
new_exists = """    // 普通前往优先排除牢房（除非明确说坐牢/牢房/劫狱）
    const isJailWant = /(牢|监|狱)/.test(wantName);
    const exists = Object.entries(world.places || {}).find(([pid, pl]) => {
      if (!isJailWant && pid.startsWith('jail_')) return false;
      return String(pl?.name || '').replace(/·.*$/, '').includes(wantName);
    });"""

assert old_exists in text, "old_exists not found in summon.js"
text = text.replace(old_exists, new_exists, 1)

# 2. 修复 SYNONYMS 匹配
old_syn = "        const hit = Object.entries(world.places || {}).find(([, pl]) => String(pl?.name || '').includes(kw));"
new_syn = """        const hit = Object.entries(world.places || {}).find(([pid, pl]) => {
          if (!/(牢|监|狱)/.test(kw) && pid.startsWith('jail_')) return false;
          return String(pl?.name || '').includes(kw);
        });"""

assert old_syn in text, "old_syn not found in summon.js"
text = text.replace(old_syn, new_syn, 1)

with open('src/world/summon.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("summon.js patched successfully!")

