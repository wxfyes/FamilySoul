import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

old_group = """        // 分组按"看的人"来定：相公用"府内/相好"，她的号用"我的人/王家/其他"
        const group = (a) => {
          if (isHusbandViewer) {
            if (a.household) return '府内';
            if (isIntimate(a)) return '相好';
            if (friendIds.has(a.id)) return '常来往';
            return '其他人';
          }
          // 她的视角：只认真的亲眷，不把"王甯"默认当成她的人
          if (a.id === actorId) return '自己';
          if (a.spouse === actorId || (me?.spouse && a.id === me.spouse)) return '我的人';
          if (a.id === 'husband') {
            // 是他的妻妾/府内人，才叫"我的人"；否则只是城里的东家
            if (me?.household || me?.spouse === 'husband') return '我的人';
            return '王掌柜府上';
          }
          if (a.household) return '王家的人';
          return '其他人';
        };"""
new_group = """        // 分组按"看的人"来定：三种视角，绝不混用
        const isWifeOfHusband = Boolean(me?.spouse === 'husband' || me?.household);
        const group = (a) => {
          if (isHusbandViewer) {
            if (a.household) return '府内';
            if (isIntimate(a)) return '相好';
            if (friendIds.has(a.id)) return '常来往';
            return '其他人';
          }
          // 女眷视角（婉儿、芸娘、小翠等真正的内室）
          if (isWifeOfHusband) {
            if (a.id === 'husband') return '我的人';
            if (a.household) return '王家';
            if (a.id === actorId) return '我的人';
            return '其他人';
          }
          // 独立市井平民视角（离析、新角色、路人男丁）
          if (a.id === actorId) return '我的人';
          if (a.spouse === actorId) return '我的人';
          if (a.id === 'husband') return '王东家';
          if (a.household) return '王府家眷';
          if (friendIds.has(a.id)) return '熟人';
          return '其他人';
        };"""
if old_group in s:
    s = s.replace(old_group, new_group, 1)
    print('① 分组按三种视角重写')

# 王甯对被展示时的身份：非女眷看到"临江茶坊少东家"，不是"相公"
old_role = """            id: a.id, name: a.name, role: a.role || '', gender: a.gender || 'female',"""
new_role = """            id: a.id, name: a.name,
            // 王甯的头衔：他的妻妾看到"相公"，外人只看到"东家"
            role: (a.id === 'husband' && !isHusbandViewer && !isWifeOfHusband)
              ? '临江茶坊少东家'
              : (a.role || ''),
            gender: a.gender || 'female',"""
if old_role in s:
    s = s.replace(old_role, new_role, 1)
    print('② 外人眼里王甯是少东家')

# 排序键跟着新分组走
old_sort = """            const o = isHusbandViewer
              ? { 府内: 0, 相好: 1, 常来往: 2, 其他人: 3 }
              : { 我的人: 0, 王家: 1, 常来往: 2, 其他人: 3 };"""
new_sort = """            const o = isHusbandViewer
              ? { 府内: 0, 相好: 1, 常来往: 2, 其他人: 3 }
              : (isWifeOfHusband
                ? { 我的人: 0, 王家: 1, 其他人: 3 }
                : { 我的人: 0, 熟人: 1, 王东家: 2, 王府家眷: 3, 其他人: 4 });"""
if old_sort in s:
    s = s.replace(old_sort, new_sort, 1)
    print('③ 排序键跟上')

# 中馈：非内宅人一律 null
old_hh = """        household: { allowance: Number(world.assets?.householdAllowance) || 4.0, arrears: world.assets?.householdArrears || { months: 0, owed: 0 }, silver: Number(world.assets?.silver) || 0 },"""
new_hh = """        household: (isHusband || (me?.household && me?.spouse === 'husband'))
          ? {
            allowance: Number(world.assets?.householdAllowance) || 4.0,
            arrears: world.assets?.householdArrears || { months: 0, owed: 0 },
            silver: Number(world.assets?.silver) || 0,
          }
          : null,"""
if old_hh in s:
    s = s.replace(old_hh, new_hh, 1)
    print('④ 中馈只给内宅人')
io.open(p, 'w', encoding='utf-8-sig').write(s)
