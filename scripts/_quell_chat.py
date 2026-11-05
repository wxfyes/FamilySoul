import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 引入剿匪入口
if 'bandits.js' not in s:
    first = s.find('\n', s.find('import '))
    s = s[:first+1] + "import { quellBandits } from './world/bandits.js';\n" + s[first+1:]
    print('① 引入 quellBandits')

# ② 苦主求庇：本地有 2 阶以上匪患时，把事实摆给天道
anchor = "    // 朝廷近况：国库多少、够不够发俸、民心如何"
block = """    // 苦主求庇：本地或邻道有 2 阶以上匪患，市井就会有人来诉苦（只给事实，台词由天道写）
    try {
      const wB = loadState(this.dataDir);
      const meB = this._viewerActorId ? wB.actors?.[this._viewerActorId] : wB.actors?.husband;
      const myCity = Object.values(wB.cities || {}).find((ct) => ct && ct.name && myPlaceName(wB, meB?.location));
      const hereRegion = String(wB.places?.[meB?.location]?.name || '').split('·')[0] || '';
      const big = Object.values(wB.bandits || {})
        .filter((b) => b && Number(b.tier) >= 2)
        .slice(0, 2);
      if (big.length) {
        const lines = big.map((b) => `${b.name}（${b.homeCity}，${b.strength} 人，${b.tier} 阶）`).join('、');
        contextHintEarly += `（【匪患实况】${lines}。若相公在城中，可安排客商或百姓来诉苦求庇；台词照实情写，别编额外的匪。）\\n`;
      }
    } catch { /* 忽略 */ }

""" + anchor
if '【匪患实况】' not in s:
    s = s.replace(anchor, block, 1)
    print('② 注入匪患实况（苦主求庇的由头）')

# ③ 聊天出征：[[quell:黑风寨|30]]
anchor2 = "    // 8. 待付款声明：[[pay:标题|选项=价|选项=价]] 挂待付款，正文剥离"
block2 = '''    // 7.7 带兵出征：[[quell:匪名|人数]] —— 说了就真打，结果写回正文
    try {
      const quellTag = reply.match(/\\[\\[quell:([^\\]]+)\\]\\]/);
      if (quellTag) {
        const parts = String(quellTag[1] || '').split('|').map((x) => x.trim());
        const want = parts[0] || '';
        const troops = Math.max(1, Math.round(Number(parts[1]) || 20));
        const wQ = loadState(this.dataDir);
        const list = Object.values(wQ.bandits || {});
        const hit = list.find((b) => b && (b.name === want || b.name.includes(want) || String(b.leader || '') === want))
          || list[0];
        if (hit) {
          const fQ = wQ.factions?.wangjia;
          const fromCity = Object.keys(fQ?.stationed || {})[0] || hit.homeCity;
          const r = quellBandits(wQ, hit.id, troops, fromCity);
          saveState(this.dataDir, wQ);
          if (r && r.ok) {
            reply = String(reply || '').replace(/\\[\\[quell:[^\\]]+\\]\\]/g, '').trim();
            reply += `\\n（${r.win ? '大获全胜' : '受挫'}：${r.text}）`;
            console.log(`[Quell] ${hit.name} → ${r.win ? '剿平' : '失败'}`);
          } else {
            reply = String(reply || '').replace(/\\[\\[quell:[^\\]]+\\]\\]/g, '').trim();
            reply += `\\n（${r?.error || '未能出征'}）`;
          }
        }
      }
    } catch (e) {
      console.warn('[Quell] 出征失败：', e.message);
    }

''' + anchor2
if '[[quell:' not in s:
    s = s.replace(anchor2, block2, 1)
    print('③ 聊天出征标签')

# ④ 提示词：告诉天道可以这么写
hint_anchor = "      contextHintEarly += '（【兵事规矩】"
hint = """      contextHintEarly += '（【出征规矩】相公若说「点齐护院去平了某寨」，你只在末尾写 [[quell:匪名|人数]]；引擎会真的打，并把战报回给你，你再写成台词。）\\n';
""" + hint_anchor
if '【出征规矩】' not in s:
    s = s.replace(hint_anchor, hint, 1)
    print('④ 出征规矩提示')

io.open(p, 'w', encoding='utf-8-sig').write(s)
