with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
i = 0
while i < len(lines):
    if "reply = `${line}\\n${String(reply).split('\\n').filter((x) => !/没人应声/.test(x)).join('\\n')}`" in lines[i]:
        # 替换这4行
        new_lines.append("              const otherSpeakers = String(reply).split('\\n').filter((x) => /^【[^】]+】/.test(x) && !/王甯/.test(x));\n")
        new_lines.append("              reply = otherSpeakers.length > 0 ? `${line}\\n${otherSpeakers.join('\\n')}`.trim() : line;\n")
        i += 3 # 跳过接下来的 .replace 和 .trim()
    else:
        new_lines.append(lines[i])
    i += 1

with open('src/pet-service.js', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Successfully replaced reply splice!")

