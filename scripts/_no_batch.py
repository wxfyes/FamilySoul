import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("      beginStateBatch();\n", "      // 不再用整轮批量写：批量快照会在收尾时把聊天里发生的真实变更（送客/进门/门第）覆盖掉\n", 1)
s = s.replace("      } finally {\n        endStateBatch(DATA_DIR);\n      }", "      } finally {\n        /* 单次写入口 saveState 已经落盘 */\n      }", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('去掉聊天批量写')
