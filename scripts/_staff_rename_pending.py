import io
# A. 护院改名迁移（一次性，flag 控制）；B. pendingAction 按人隔离
p = 'src/world/state.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { ensureResidence } from './residence.js';",
              "import { ensureResidence } from './residence.js';\nimport { fallbackName } from './migration.js';", 1)
old = "      // 房间分级补正（老存档）"
new = """      // 一次性：把早年自拟名单生成的护院/家丁，改成世界姓名池里的名字（id 不变）
      try {
        if (!world.flags?.staffRenameV1) {
          let renamed = 0;
          for (const a of Object.values(world.actors || {})) {
            if (!a || a.dead) continue;
            if (!/护院|家丁/.test(String(a.role || ''))) continue;
            if (!String(a.id || '').startsWith('staff_')) continue;
            if (!/阿[福顺贵全安平庆寿泰和义勇]/.test(String(a.name || ''))) continue;
            const nm = fallbackName(world, 'male');
            if (!nm) continue;
            console.log(`[Staff] 改名：${a.name} → ${nm}`);
            a.name = nm;
            renamed += 1;
          }
          world.flags = world.flags || {};
          world.flags.staffRenameV1 = { at: Date.now(), renamed };
          console.log(`[Staff] 护院改名完成：${renamed} 人`);
        }
      } catch { /* 忽略 */ }

      // 房间分级补正（老存档）"""
if old in s and 'staffRenameV1' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('A 护院改名迁移')

p2 = 'src/server.js'
t = io.open(p2, encoding='utf-8-sig').read()
old2 = "        pendingAction: world.pendingAction || null,"
new2 = """        // 待付款只给当事人看：别人的账单不能弹到新人头上
        pendingAction: (() => {
          const p = world.pendingAction;
          if (!p) return null;
          const meId = String(actorId || 'husband');
          const owner = String(p.by || 'husband');
          return owner === meId ? p : null;
        })(),"""
if old2 in t:
    t = t.replace(old2, new2, 1)
    io.open(p2, 'w', encoding='utf-8-sig').write(t)
    print('B 待付款按人隔离')
