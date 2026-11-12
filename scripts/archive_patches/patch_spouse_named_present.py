with open('src/pet-service.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """          const namedPresent = Object.values(wPost.actors || {}).filter(
            (a) => a && !a.dead && a.id !== this._viewerActorId && a.id !== 'husband'
              && a.location === locPost && a.name && String(say || '').includes(a.name),
          );"""

replacement = """          const namedPresent = Object.values(wPost.actors || {}).filter(
            (a) => a && !a.dead && a.id !== this._viewerActorId && a.id !== 'husband'
              && a.location === locPost && a.name && (String(say || '').includes(a.name) || (namedSpouse && (a.id === mePost?.spouse || a.spouse === this._viewerActorId || /于子归|于杰/.test(a.name)))),
          );"""

if target in text:
    text = text.replace(target, replacement)
    with open('src/pet-service.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Successfully patched namedPresent for spouse in pet-service.js!")
else:
    print("Target not found in pet-service.js")

