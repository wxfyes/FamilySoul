with open('src/server.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = "let pid = Object.keys(world.places).find((k) => world.places[k]?.name === placeName);"
replacement = "let pid = world.places[placeName] ? placeName : Object.keys(world.places).find((k) => world.places[k]?.name === placeName);"

if target in text:
    text = text.replace(target, replacement)
    with open('src/server.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully patched actor move in server.js!")
else:
    print("Target not found in server.js")

