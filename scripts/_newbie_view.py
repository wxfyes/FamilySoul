import io

# ============ ① 菜单：新人物视角不再把王甯当"我的人" ============
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          // 她的视角
          if (a.id === 'husband') return '我的人';
          if (a.spouse === actorId || (me?.spouse && a.id === me.spouse)) return '我的人';
          if (a.household) return '王家';
          if (a.id === actorId) return '我的人';
          return '其他人';"""
new = """          // 她的视角：只认真的亲眷，不把"王甯"默认当成她的人
          if (a.id === actorId) return '自己';
          if (a.spouse === actorId || (me?.spouse && a.id === me.spouse)) return '我的人';
          if (a.id === 'husband') {
            // 是他的妻妾/府内人，才叫"我的人"；否则只是城里的东家
            if (me?.household || me?.spouse === 'husband') return '我的人';
            return '王掌柜府上';
          }
          if (a.household) return '王家的人';
          return '其他人';"""
if old in s:
    s = s.replace(old, new, 1)
    print('① 菜单分组按真实亲眷判定')
io.open(p, 'w', encoding='utf-8-sig').write(s)

# ============ ② 提示词：给玩家一个诚实的身份，不许把王甯当她相公 ============
p2 = 'src/pet-service.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = """            '2. 主动做事与配合帮衬：面对玩家提要求、抱怨、托付或遇到难处，在场角色要立足自身本分主动表态、主动分担、主动配合推进解决（如工头主动张罗修缮翻新、揽大活挣工钱；相公主动担当遮风挡雨；熟人出谋划策），牵动世界运转！',"""
new2 = """            '2. 主动做事与配合帮衬：面对玩家提要求、抱怨、托付或遇到难处，在场角色要立足自身本分主动表态、主动分担、主动配合推进解决（如工头主动张罗修缮翻新、揽大活挣工钱；熟人出谋划策），牵动世界运转！',
            // 身份铁律：新玩家不是王家人，王甯也不是她的相公
            (() => {
              const kin = Boolean(a.household || a.spouse === 'husband' || (Array.isArray(a.parents) && a.parents.includes('husband')));
              const lines2 = [
                `玩家是「${a.name}」${a.role ? `（${a.role}）` : ''}，**不是王甯**，也不是"相公"这个称呼的主人。`,
              ];
              if (kin) {
                lines2.push('王甯是她的丈夫/东家，可称"相公"；谈家事只谈她自己那一段。');
              } else {
                lines2.push('王甯与她并无婚配，只是临江城的东家王掌柜；旁人提到他时称"王掌柜/王相公"，**绝不可说"你相公"，也不可把她当成王家人**。');
                lines2.push('不许替她编造夫君、宅院、亲眷；她有什么，账上写着才算。');
              }
              return lines2.join('\\n');
            })(),"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    print('② 玩家身份铁律')

# ============ ③ 隔空应声：只有他的妻妾/府内人喊，王甯才会隔空应声 ============
old3 = """        const calledHusband = /(王甯|王掌柜|少掌柜|当家的|相公)/.test(String(say || ''));
          if (husActor && !husActor.dead && calledHusband && husActor.location !== locPost) {"""
new3 = """        const meIsKin = Boolean(mePost?.household || mePost?.spouse === 'husband' || (Array.isArray(mePost?.parents) && mePost.parents.includes('husband')));
          const calledHusband = meIsKin && /(王甯|王掌柜|少掌柜|当家的|相公)/.test(String(say || ''));
          if (husActor && !husActor.dead && calledHusband && husActor.location !== locPost) {"""
if old3 in t:
    t = t.replace(old3, new3, 1)
    print('③ 隔空应声只限亲眷')
io.open(p2, 'w', encoding='utf-8-sig').write(t)
