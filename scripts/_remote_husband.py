import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = """          const namedPresent = Object.values(wPost.actors || {}).filter(
            (a) => a && !a.dead && a.id !== this._viewerActorId && a.id !== 'husband'
              && a.location === locPost && a.name && (String(say || '').includes(a.name) || (namedSpouse && (a"""
new = """          // 隔着地方喊相公：他不能瞬移，但可以应一声（他是真人，由天道代他开口）
          const husActor = wPost.actors?.husband;
          const calledHusband = /(王甯|王掌柜|少掌柜|当家的|相公)/.test(String(say || ''));
          if (husActor && !husActor.dead && calledHusband && husActor.location !== locPost) {
            try {
              const hisLine = await this._proxyHusbandRemote({ world: wPost, say, viewerId: this._viewerActorId, profileKey });
              if (hisLine && !String(reply || '').includes('王甯')) {
                reply = `${String(reply || '').trim()}\\n【王甯】：${String(hisLine).replace(/^【[^】]+】：/, '').trim()}`.trim();
                console.log('[Proxy] 隔空应声：王甯');
              }
            } catch { /* 忽略 */ }
          }

          const namedPresent = Object.values(wPost.actors || {}).filter(
            (a) => a && !a.dead && a.id !== this._viewerActorId && a.id !== 'husband'
              && a.location === locPost && a.name && (String(say || '').includes(a.name) || (namedSpouse && (a"""
if old in s and '_proxyHusbandRemote' not in s:
    s = s.replace(old, new, 1)
    print('① 加入隔空应声')

# 简单实现：借天道一句，不许提不该知道的事
anchor = "  // 任何被点名的在场者，若主模型不肯写他，就单独代演一句"
impl = """  // 隔空应一声：他人在别处，回一句话，不挪窝
  async _proxyHusbandRemote({ world, say, viewerId }) {
    try {
      if (!this.llmClient?.isReady?.()) return null;
      const me = world.actors?.husband;
      const her = world.actors?.[viewerId];
      const where = world.places?.[me?.location]?.name || '';
      const sys = '你在演王甯（茶商，说话简短，不客套）。只回他此刻会说的一两句话，不要旁白。';
      const usr = [
        `${her?.name || '她'}在${world.places?.[her?.location]?.name || '别处'}隔空问起你：${String(say || '').slice(0, 40)}`,
        `你此刻在${where}。你答一句，别写你过去了。`,
      ].join('\\n');
      const out = await this.llmClient.complete({ system: sys, messages: [{ role: 'user', content: usr }], temperature: 0.7, maxTokens: 160 });
      const text = typeof out === 'string' ? out : (out?.text || out?.content || out?.reply || '');
      return String(text || '').trim().replace(/^【[^】]+】：/, '');
    } catch { return null; }
  }

""" + anchor
if anchor in s and '_proxyHusbandRemote({' not in s.split('async _proxyHusbandRemote')[0]:
    s = s.replace(anchor, impl, 1)
    print('② 实现隔空应声')
io.open(p, 'w', encoding='utf-8').write(s)
