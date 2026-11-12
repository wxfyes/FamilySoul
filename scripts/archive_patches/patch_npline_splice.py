with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''            if (npLine) {
              reply = `${npLine}\\n${String(reply).split('\\n').filter((x) => !/没人应声|没人接话|就站在|四下冷清|你到了/.test(x)).join('\\n')}`.trim();'''

replacement = '''            if (npLine) {
              const otherSpeakers = String(reply).split('\\n').filter((x) => /^【[^】]+】/.test(x) && !x.includes(npc.name));
              reply = otherSpeakers.length > 0 ? `${npLine}\\n${otherSpeakers.join('\\n')}`.trim() : npLine;'''

if target in text:
    text = text.replace(target, replacement)
    with open('src/pet-service.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully replaced npLine reply splice!")
else:
    print("Target not found!")

