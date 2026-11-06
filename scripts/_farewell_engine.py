import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
anchor = "    // 9. NPC 告辞离场：先照 [[depart:谁|去哪]] 把真位移走完，再清标签"
add = """    // 8.9 相公明确说"你走吧/退下/送客"：不靠天道自觉写标签，引擎直接让人离场
    try {
      const farewellSay = /^(?:你|你们|都|先)?\\s*(?:走|回去吧|回吧|退下|下去|散了|去吧|出门吧|慢走|送客)[。！!~…\\s]*$/.test(String(sayText || '').trim())
        || /送客|你回吧|你走吧|退下吧|都散了吧/.test(String(sayText || '').trim());
      if (farewellSay && !/\\[\\[depart:/.test(String(reply || ''))) {
        const wF = loadState(this.dataDir);
        const meF = wF.actors?.[this._viewerActorId || 'husband'] || wF.actors?.husband;
        const hereF = Object.values(wF.actors || {}).filter(
          (a) => a && !a.dead && a.id !== meF?.id && a.location === meF?.location && !/^usr_/.test(String(a.id)),
        );
        // 只让"该走的人"走：不是主人家的客/当值的人
        const goers = hereF.filter((a) => !(a.household && meF?.id === 'husband'));
        if (goers.length && goers.length <= 3) {
          const names = [];
          for (const a of goers) {
            const back = a.quarters || a.home || 'street';
            if (wF.places?.[back] && moveActor(wF, a.id, back, 'world', '告辞离场')) names.push(a.name);
          }
          if (names.length) {
            saveState(this.dataDir, wF);
            reply = String(reply || '') + `\\n（${names.join('、')}起身告辞，退了出去。）`;
            console.log(`[Departure] 相公送客，${names.join('、')} 真的走了`);
          }
        }
      }
    } catch (err) { console.warn('[Departure] 送客处理失败：', err.message); }

""" + anchor
if '不靠天道自觉写标签' not in s:
    s = s.replace(anchor, add, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 相公送客直接让人离场')
