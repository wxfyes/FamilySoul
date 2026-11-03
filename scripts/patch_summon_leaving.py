with open('src/world/summon.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

old_leaving_move = """    if (me.location !== home) {
      me.location = home;
      saveState(dataDir, world);
      return { moved: [me.name || '相公'], summoned: [], visited: null, left: true };
    }"""

new_leaving_move = """    if (me.location !== home) {
      const companions = findCompanions(world, selfId, say);
      me.location = home;
      const comers = [];
      for (const c of companions) {
        if (c && !c.dead && c.id !== me.id) {
          c.location = home;
          comers.push(c.name);
        }
      }
      saveState(dataDir, world);
      return { moved: [me.name || '相公', ...comers], summoned: [], visited: null, left: true };
    }"""

assert old_leaving_move in text, "old_leaving_move not found in summon.js"
text = text.replace(old_leaving_move, new_leaving_move, 1)

with open('src/world/summon.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("summon.js leaving companions updated successfully!")

