import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "          const proxyTargets = namedPresent.length ? namedPresent : (partnerHere.length && !replyHasPresentSpeaker ? partnerHere : []);"
new = """          // 没人被点名时，谁接话？规则：
          //   ① 他上次跟谁说话，就还是谁
          //   ② 否则此处在场者只有一个 → 就是他
          //   ③ 否则取最近在聊天记录里说过话的那位
          // 这样新人进屋，隔壁邻居会真的应声，而不是"四下清静"
          let fallbackTarget = [];
          if (!namedPresent.length && !partnerHere.length && !replyHasPresentSpeaker) {
            const presentOthers = Object.values(wPost.actors || {})
              .filter((a) => a && !a.dead && a.name && a.location === locPost && a.id !== this._viewerActorId && a.id !== 'husband');
            if (presentOthers.length === 1) fallbackTarget = presentOthers;
            else if (presentOthers.length > 1) {
              const recentText = (this.readHistory(profileKey).messages || []).slice(-6).map((m) => String(m?.text || '')).join('\\n');
              const spoke = presentOthers.find((a) => recentText.includes(`【${a.name}】`));
              fallbackTarget = spoke ? [spoke] : [presentOthers[0]];
            }
          }
          const proxyTargets = namedPresent.length ? namedPresent
            : (partnerHere.length && !replyHasPresentSpeaker ? partnerHere : fallbackTarget);"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 无人点名时由在场者接话')
