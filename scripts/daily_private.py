import io

# ============ ① 服务端：daily 改为"只看自己" ============
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

start = s.find("        daily: (() => {")
end = s.find("        })()", start)
if start < 0 or end < 0:
    print('WARN: daily 块没找到')
else:
    end += len("        })()")
    block = """        // 我这一日：只给"我自己"的事，绝不广播别人的私事
        daily: (() => {
          try {
            const evs = readRecentEvents(DATA_DIR, 200) || [];
            const today = Number(world.clock?.day) || 1;
            const myName = me?.name || '';
            if (!myName) return [];
            const lines = evs
              .filter((e) => e && Number(e.day) >= today - 1 && String(e.text || '').includes(myName))
              .slice(-5)
              .map((e) => String(e.text || '').slice(0, 48));
            return [{ name: myName, place: place?.name || '', lines }];
          } catch { return []; }
        })(),"""
    s = s[:start] + block + s[end:]
    print('① daily 改成只看自己')
io.open(p, 'w', encoding='utf-8').write(s)

# ============ ② App：标题改成"我这一日" ============
p2 = 'mobile/lib/views/my_world_screen.dart'
d = io.open(p2, encoding='utf-8').read()
d = d.replace("_sectionTitle('各人今日动向')", "_sectionTitle('我这一日')")
d = d.replace("// 各人今日动向", "// 我这一日（只有自己的事）")
io.open(p2, 'w', encoding='utf-8').write(d)
print('② 标题改为我这一日')
print('done')
