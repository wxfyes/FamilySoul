import re

# 1. 修复 src/world/member-reply.js
# 丢掉 【地点】： 的伪装，改为纯环境旁白括号
path_mr = 'src/world/member-reply.js'
with open(path_mr, 'r', encoding='utf-8') as f:
    c_mr = f.read()

old_mr = '''  // 全部被丢：用账本事实兜底，不写任何人台词
  if (kept.length === 0) {
    if (ctx?.askedHusband && ctx?.husbandPlace) {
      return `【${placeLabel}】：他此刻在「${ctx.husbandPlace}」，眼下不在这屋里。`;
    }
    return `【${placeLabel}】：（屋里一时没人应声。）`;
  }'''

new_mr = '''  // 全部被丢：用账本事实兜底，不写任何人台词
  if (kept.length === 0) {
    if (ctx?.askedHusband && ctx?.husbandPlace) {
      return `（相公此刻人在「${ctx.husbandPlace}」，眼下并不在跟前。）`;
    }
    return `（四下清静，一时无人接话。）`;
  }'''

if old_mr in c_mr:
    c_mr = c_mr.replace(old_mr, new_mr)
    with open(path_mr, 'w', encoding='utf-8') as f:
        f.write(c_mr)
    print("Successfully patched src/world/member-reply.js")
else:
    print("Warning: old_mr not found in src/world/member-reply.js")

# 2. 修复 src/pet-service.js 中的地名成精 + 王甯不在场却千里传音
path_ps = 'src/pet-service.js'
with open(path_ps, 'r', encoding='utf-8') as f:
    c_ps = f.read()

# 替换转场头和空场头（去掉【地名】：）
c_ps = c_ps.replace(
    "const head = `【${placeNow2}】：（你到了${placeNow2}。）`;",
    "const head = `（你到了${placeNow2}。）`;"
)

old_empty = '''          reply = hereText
            ? `【${placeNow || '这里'}】：${lead}——${hereText}。`
            : `【${placeNow || '这里'}】：${lead}，四下冷清，没什么人。`;'''

new_empty = '''          reply = hereText
            ? `（${lead}——${hereText}。）`
            : `（${lead}，四下冷清，没什么人。）`;'''

c_ps = c_ps.replace(old_empty, new_empty)

# 修复王甯代演条件：相公必须真实在场 (husHere === true)，且没有被明确斥退！
old_proxy_cond = '''        const namedHim = /(王甯|王掌柜|少掌柜|相公)/.test(said);
        const askedHim = namedHim || (!talkingToOther && (partnerIsHusband || !partnerId));
        if (askedHim && !/【[^】]*王甯/.test(String(reply))) {'''

new_proxy_cond = '''        const namedHim = /(王甯|王掌柜|少掌柜|相公)/.test(said);
        const dismissedHim = /(一边去|走开|离我远点|别管我|闭嘴|自己待着|别理我|嫌烦)/.test(said);
        if (dismissedHim) {
          try {
            const wt = loadState(this.dataDir);
            wt.chatPartners = wt.chatPartners || {};
            delete wt.chatPartners[this._viewerActorId];
            saveState(this.dataDir, wt);
          } catch {}
        }
        // 铁律：王甯必须真实在场 (husHere)！不在场严禁千里传音，绝不做狗皮膏药
        const askedHim = !dismissedHim && husHere && (namedHim || (!talkingToOther && (partnerIsHusband || !partnerId)));
        if (askedHim && !/【[^】]*王甯/.test(String(reply))) {'''

if old_proxy_cond in c_ps:
    c_ps = c_ps.replace(old_proxy_cond, new_proxy_cond)
    print("Successfully patched askedHim and husHere in src/pet-service.js")
else:
    print("Warning: old_proxy_cond not found in src/pet-service.js")

# 修复王甯代演后拼接回复：若王甯说话了，坚决丢弃所有空场废话（如"四下冷清没什么人"、"就站在"等）
old_splice = '''            if (line) {
              reply = `${line}\\n${String(reply).split('\\n').filter((x) => !/没人应声/.test(x)).join('\\n')}`
                .replace(/\\n{2,}/g, '\\n')
                .trim();
            }'''

new_splice = '''            if (line) {
              const otherSpeakers = String(reply).split('\\n').filter((x) => /^【[^】]+】/.test(x) && !/王甯/.test(x));
              reply = otherSpeakers.length > 0 ? `${line}\\n${otherSpeakers.join('\\n')}`.trim() : line;
            }'''

if old_splice in c_ps:
    c_ps = c_ps.replace(old_splice, new_splice)
    print("Successfully patched reply splice in src/pet-service.js")
else:
    print("Warning: old_splice not found in src/pet-service.js")

with open(path_ps, 'w', encoding='utf-8') as f:
    f.write(c_ps)

print("Patch complete.")

