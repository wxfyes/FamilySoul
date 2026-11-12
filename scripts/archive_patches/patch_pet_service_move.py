import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8').read()

target1 = """          if (named3) {
            const where3 = String(wLoc.places?.[named3.location]?.name || '别处');
            const here3 = String(wLoc.places?.[locId2]?.name || '这里');
            reply = `【${here3}】：${named3.name}在「${where3}」，眼下不在这儿。`;
            console.log(`[Scene] ${named3.name}不在场，照实报位置：${where3}`);
          } else {
            reply = '';
          }"""

replacement1 = """          if (named3) {
            const where3 = String(wLoc.places?.[named3.location]?.name || '别处');
            const here3 = String(wLoc.places?.[locId2]?.name || '这里');
            reply = `【${here3}】：${named3.name}在「${where3}」，眼下不在这儿。`;
            console.log(`[Scene] ${named3.name}不在场，照实报位置：${where3}`);
          } else if (segs3.length > 0) {
            // 避免死寂省略号：刚才相公明明在跟对方说话，若因后台瞬移被误杀，宽容放行
            reply = segs3.join('').trim();
            console.log(`[Scene] 避免死寂省略号，放行当轮回复：${reply.slice(0, 30)}`);
          } else {
            reply = '';
          }"""

target2 = "'没变化只输出 [[world:none]]。人物换地方记 move（相公也记，who=husband）；值得记一辈子的事记 remember。',"
replacement2 = "'没变化只输出 [[world:none]]。人物跨建筑换地方记 move（相公也记，who=husband；绝对严禁把门口、门外、院中、屋里等微动作记为 move！）；值得记一辈子的事记 remember。',"

s_norm = s.replace('\r\n', '\n')
target1_norm = target1.replace('\r\n', '\n')
replacement1_norm = replacement1.replace('\r\n', '\n')

if target1_norm in s_norm:
    s_norm = s_norm.replace(target1_norm, replacement1_norm, 1)
    if target2 in s_norm:
        s_norm = s_norm.replace(target2, replacement2, 1)
    if '\r\n' in s:
        s_norm = s_norm.replace('\n', '\r\n')
    io.open(p, 'w', encoding='utf-8').write(s_norm)
    print('patch_pet_service_move: success')
else:
    print('patch_pet_service_move: target1 not found')

