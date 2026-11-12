with open('src/world/dispatch.js', 'r', encoding='utf-8') as f:
    text = f.read().replace('\r\n', '\n')

# 1. 修复 asset 标签隔离
old_asset = """      } else if (kind === 'asset') {
        const delta = Number(args.delta);
        if (!Number.isFinite(delta)) continue;
        world.assets.silver = round2((world.assets.silver || 0) + delta);
        applied.push(`银两${delta >= 0 ? '+' : ''}${delta}`);"""

new_asset = """      } else if (kind === 'asset') {
        const delta = Number(args.delta);
        if (!Number.isFinite(delta)) continue;
        const targetActor = String(args.who || (selfId !== 'husband' ? selfId : 'husband'));
        if (targetActor === 'husband') {
          world.assets.silver = round2((world.assets.silver || 0) + delta);
          applied.push(`公账银两${delta >= 0 ? '+' : ''}${delta}`);
        } else {
          world.wallets = world.wallets || {};
          world.wallets[targetActor] = round2((Number(world.wallets[targetActor]) || 0) + delta);
          const an = world.actors?.[targetActor]?.name || targetActor;
          applied.push(`${an}私房${delta >= 0 ? '+' : ''}${delta}两`);
        }"""

assert old_asset in text, "old_asset not found in dispatch.js"
text = text.replace(old_asset, new_asset, 1)

# 2. 修复 spend 标签隔离
old_spend_who = "        const who = String(args.who || 'husband');"
new_spend_who = "        const who = String(args.who || (selfId !== 'husband' ? selfId : 'husband'));"

assert old_spend_who in text, "old_spend_who not found in dispatch.js"
text = text.replace(old_spend_who, new_spend_who, 1)

with open('src/world/dispatch.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("dispatch.js asset and spend decoupling patched successfully!")

