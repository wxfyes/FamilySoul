import io
p = 'src/world/clock.js'
lines = io.open(p, encoding='utf-8-sig').read().split('\n')
idx = None
for i, l in enumerate(lines):
    if l.strip() == "import { moveActor } from './position.js';":
        idx = i
        break
if idx is None:
    raise SystemExit('找不到位置')
lines = lines[:idx+1] + [
    "import { runMilitaryDay, setWarEventSink } from './warfare.js';",
    "import { npcStrategyTurn } from './strategy.js';",
] + lines[idx+1:]
io.open(p, 'w', encoding='utf-8-sig').write('\n'.join(lines))
print('import 插到 moveActor 之后')
