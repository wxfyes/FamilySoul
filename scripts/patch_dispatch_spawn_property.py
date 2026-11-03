with open('src/world/dispatch.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

# 1. 完善 property 的 owner
old_prop = """        world.assets.properties.push({
          id: `prop_${world.flags.propSeq}`,
          name,
          kind: String(args.kind || 'shops').slice(0, 12),
          incomePerDay: Math.max(0, Number(args.set ?? args.income ?? 0) || 0),
          status: String(args.status || '筹备开张').slice(0, 12),
          place: placeId,
          keeper: keeper?.id || null,
          staff,
          city,
          note: String(args.note || '').slice(0, 60),
          openedDay: world.clock.day,
        });"""

new_prop = """        const propOwner = String(args.owner || selfId || 'husband');
        world.assets.properties.push({
          id: `prop_${world.flags.propSeq}`,
          name,
          kind: String(args.kind || 'shops').slice(0, 12),
          incomePerDay: Math.max(0, Number(args.set ?? args.income ?? 0) || 0),
          status: String(args.status || '筹备开张').slice(0, 12),
          place: placeId,
          keeper: keeper?.id || (propOwner !== 'husband' ? propOwner : null),
          owner: propOwner,
          staff,
          city,
          note: String(args.note || '').slice(0, 60),
          openedDay: world.clock.day,
        });"""

assert old_prop in text, "old_prop not found in dispatch.js"
text = text.replace(old_prop, new_prop, 1)

# 2. 完善 spawn 的 home 与基础 schedule
old_spawn_loc = """        world.actors[id] = {
          id,
          name,
          origin: 'spawned', // 标记：天道自己长出来的人
          gender: String(args.gender || 'female'),
          role: String(args.role || '城中人'),
          location: (() => {
            const asked = resolvePlace(world, args.place);
            if (asked) return asked;
            // 按行当给个自己的地方：郎中开药铺、稳婆有家、绣娘有绣坊
            const r = String(args.role || '');
            let placeName = '';
            if (/郎中|大夫|医/.test(r)) placeName = `${name}的药铺`;
            else if (/稳婆|接生/.test(r)) placeName = `${name}家`;
            else if (/媒婆|牙婆/.test(r)) placeName = `${name}家`;
            else if (/绣娘|绣/.test(r)) placeName = `${name}的绣坊`;
            else if (/仵作|衙役|更夫/.test(r)) return 'yamen';
            else if (/掌柜|东家/.test(r)) placeName = `${name}的铺子`;
            else if (/道士|尼姑/.test(r)) placeName = `${name}的道观`;
            if (!placeName) return 'street';
            world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
            const pid = `place_${world.flags.placeSeq}`;
            world.places[pid] = { name: placeName.slice(0, 20), exits: ['street'], owner: id, dynamic: true };
            return pid;
          })(),
          goals: String(args.goals || '').split(';').map((s) => s.trim()).filter(Boolean),
          secret: String(args.secret || '').trim() || undefined,
          relations: { husband: { trust: 50, desire: 30, fear: 0, grievance: 0 } },
          intimacy: { level: 1, tone: 0, lastAt: 0, ritual: 'solemn' },
          schedule: [],
        };"""

new_spawn_loc = """        const assignedLoc = (() => {
          const asked = resolvePlace(world, args.place);
          if (asked) return asked;
          // 按行当给个自己的地方：郎中开药铺、稳婆有家、绣娘有绣坊
          const r = String(args.role || '');
          let placeName = '';
          if (/郎中|大夫|医/.test(r)) placeName = `${name}的药铺`;
          else if (/稳婆|接生/.test(r)) placeName = `${name}家`;
          else if (/媒婆|牙婆/.test(r)) placeName = `${name}家`;
          else if (/绣娘|绣/.test(r)) placeName = `${name}的绣坊`;
          else if (/仵作|衙役|更夫/.test(r)) return 'yamen';
          else if (/掌柜|东家/.test(r)) placeName = `${name}的铺子`;
          else if (/道士|尼姑/.test(r)) placeName = `${name}的道观`;
          if (!placeName) return 'street';
          world.flags.placeSeq = (Number(world.flags.placeSeq) || 0) + 1;
          const pid = `place_${world.flags.placeSeq}`;
          world.places[pid] = { name: placeName.slice(0, 20), exits: ['street'], owner: id, dynamic: true };
          return pid;
        })();

        const assignedHome = assignedLoc !== 'street' && assignedLoc !== 'yamen' ? assignedLoc : 'street';

        world.actors[id] = {
          id,
          name,
          origin: 'spawned', // 标记：天道自己长出来的人
          gender: String(args.gender || 'female'),
          role: String(args.role || '城中人'),
          location: assignedLoc,
          home: assignedHome,
          goals: String(args.goals || '').split(';').map((s) => s.trim()).filter(Boolean),
          secret: String(args.secret || '').trim() || undefined,
          relations: { husband: { trust: 50, desire: 30, fear: 0, grievance: 0 } },
          intimacy: { level: 1, tone: 0, lastAt: 0, ritual: 'solemn' },
          schedule: [
            { at: 8, do: `在${world.places?.[assignedLoc]?.name || '铺子'}操持营生`, place: assignedLoc },
            { at: 12, do: '用饭歇晌', place: assignedLoc },
            { at: 18, do: '收档打烊', place: assignedHome },
            { at: 22, do: '安歇歇息', place: assignedHome },
          ],
        };"""

assert old_spawn_loc in text, "old_spawn_loc not found in dispatch.js"
text = text.replace(old_spawn_loc, new_spawn_loc, 1)

with open('src/world/dispatch.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("dispatch.js spawn and property enhancement patched successfully!")

