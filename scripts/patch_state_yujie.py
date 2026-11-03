with open('src/world/state.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

old_court = """    if (world.actors?.liuwenxia && !world.actors.liuwenxia.spouse) world.actors.liuwenxia.spouse = 'yujie';
    if (world.actors?.yujie && !world.actors.yujie.spouse) world.actors.yujie.spouse = 'liuwenxia';"""

new_court = """    // 查明紫嫣名义上的丈夫（于子归/于杰，无论id是npc_2还是yujie）
    let yujieActor = Object.values(world.actors || {}).find((a) => a && !a.dead && /于子归|于杰/.test(a.name || ''));
    if (yujieActor) {
      yujieActor.home = 'wine_shop';
      yujieActor.spouse = 'liuwenxia';
      if (!Array.isArray(yujieActor.schedule) || yujieActor.schedule.length === 0) {
        yujieActor.schedule = [
          { at: 7, do: '去长街承揽土木活计', place: 'street' },
          { at: 12, do: '在街边面摊用饭歇脚', place: 'noodle_stall' },
          { at: 18, do: '回于家酒肆收工歇脚', place: 'wine_shop' },
          { at: 22, do: '在酒肆后院安歇', place: 'wine_shop' },
        ];
      }
      if (world.actors?.liuwenxia) {
        world.actors.liuwenxia.spouse = yujieActor.id;
      }
    } else {
      if (world.actors?.liuwenxia && !world.actors.liuwenxia.spouse) world.actors.liuwenxia.spouse = 'yujie';
      if (world.actors?.yujie && !world.actors.yujie.spouse) world.actors.yujie.spouse = 'liuwenxia';
    }"""

assert old_court in text, "old_court not found in state.js"
text = text.replace(old_court, new_court, 1)

with open('src/world/state.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("state.js yujie schedule and spouse patched successfully!")

