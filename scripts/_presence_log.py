import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        if (moved) { saveState(this.dataDir, wR0); console.log(`[Presence] ${moved} 位内眷到了跟前`); }
      }
    } catch { /* 忽略 */ }"""
new = """        if (moved) { saveState(this.dataDir, wR0); console.log(`[Presence] ${moved} 位内眷到了跟前`); }
        else console.log('[Presence] 没有需要走动的内眷');
      }
    } catch (err) { console.warn('[Presence] 请人失败：', err.message); }"""
if old in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('加日志')
