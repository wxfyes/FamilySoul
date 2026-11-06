import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          const wantedParents = new Set([myHome, curId].filter(Boolean));
          for (const pid of wantedParents) {"""
new = """          const wantedParents = new Set([myHome, curId].filter(Boolean));
          // 公开营业的场所（酒楼/茶坊/茶栈/客栈/衙署），不论在哪个城，院子都进菜单，雅阁才搜得到
          for (const [pid, pl] of Object.entries(world.places || {})) {
            if (!pl || !pl.rooms) continue;
            if (wantedParents.has(pid)) continue;
            const pub = pl.use === 'restaurant' || pl.use === 'shop' || pl.use === 'court'
              || /酒楼|茶坊|茶栈|客栈|衙署|县衙|码头/.test(String(pl.name || ''));
            if (pub) wantedParents.add(pid);
            if (wantedParents.size > 80) break;
          }
          let addedRooms = 0;
          for (const pid of wantedParents) {"""
if old in s:
    s = s.replace(old, new, 1)
    s = s.replace("""            places.sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'));
          }
        } catch { /* 忽略 */ }""",
"""            places.sort((x, y) => (x.near - y.near) || (y.count - x.count) || x.name.localeCompare(y.name, 'zh'));
            if (addedRooms === 0 || true) addedRooms += Object.keys(parent.rooms).length;
          }
          console.log(`[Menu] 补入院子：父地点 ${wantedParents.size} 处，菜单 ${places.length} 条`);
        } catch (e) { console.log('[Menu] 补院子失败：', e.message); }""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 真正加上公开场所循环')
