with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''          const knownActor = Object.values(wLoc.actors || {}).find((a) => a && a.name === who);
          const samePlaceName = knownActor && wLoc.places?.[knownActor.location]?.name
            && wLoc.places?.[knownActor.location]?.name === wLoc.places?.[locId2]?.name;
          if (knownActor && knownActor.location !== locId2 && !samePlaceName) {
            console.log(`[Scene] 掐掉不在场的人：${who}`);
            return false;
          }'''

replacement = '''          const knownActor = Object.values(wLoc.actors || {}).find((a) => a && a.name === who);
          const pName1 = String(wLoc.places?.[knownActor?.location]?.name || '');
          const pName2 = String(wLoc.places?.[locId2]?.name || '');
          const samePlaceName = knownActor && pName1 && (pName1 === pName2 || (pName1.includes('县衙') && pName2.includes('县衙')) || (pName1.includes('茶坊') && pName2.includes('茶坊')) || (pName1.includes('酒楼') && pName2.includes('酒楼')) || (pName1.includes('酒肆') && pName2.includes('酒肆')) || (pName1.includes('长街') && pName2.includes('长街')));
          if (knownActor && knownActor.location !== locId2 && !samePlaceName) {
            console.log(`[Scene] 掐掉不在场的人：${who}`);
            return false;
          }'''

if target in text:
    text = text.replace(target, replacement)
    with open('src/pet-service.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully patched co-presence tolerance in pet-service.js")
else:
    print("Target not found in pet-service.js")

