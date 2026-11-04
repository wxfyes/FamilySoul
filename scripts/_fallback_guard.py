import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# 标记：已经有人应声（隔空应声/已有说话人），就别再抢话
old = """              if (hisLine && !String(reply || '').includes('王甯')) {"""
new = """              if (hisLine && !String(reply || '').includes('王甯')) {
                global.__husbandRemoteAnswered = true;"""
if old in s and '__husbandRemoteAnswered' not in s:
    s = s.replace(old, new, 1)
    print('① 标记隔空应声')

old2 = """          if (!namedPresent.length && !partnerHere.length && !replyHasPresentSpeaker) {"""
new2 = """          if (!namedPresent.length && !partnerHere.length && !replyHasPresentSpeaker
              && !global.__husbandRemoteAnswered && !/【[^】]{1,8}】：/.test(String(reply || ''))) {"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('② 有人应声就不再补')

# 用完清标记
old3 = """          console.log('[Proxy] 点名候选 ' + namedPresent.length + ' 人：'"""
new3 = """          global.__husbandRemoteAnswered = false;
          console.log('[Proxy] 点名候选 ' + namedPresent.length + ' 人：'"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print('③ 清标记')
io.open(p, 'w', encoding='utf-8-sig').write(s)
