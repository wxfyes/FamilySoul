import io

p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()

# 把 stepWorld 挂到全局，供路由调用（它定义在启动回调的作用域里）
old = "  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）"
new = (
    "  globalThis.__stepWorld = stepWorld;\n"
    "  globalThis.__worldGenerators = { generateCase, judgeCases, resolveMemorials, generateDecree, generateCityShops, generateNpcArcs };\n\n"
    "  // 世界引擎：启动天道时钟（离线补算 + 定时心跳）"
)
if old in s and 'globalThis.__stepWorld' not in s:
    s = s.replace(old, new, 1)
    print('exposed stepWorld globally')

# 路由改为调用全局
s = s.replace(
    "        const log = await stepWorld(days);",
    "        if (typeof globalThis.__stepWorld !== 'function') {\n"
    "          return sendJson(res, 503, { ok: false, error: '世界还没启动完，稍后再试' });\n"
    "        }\n"
    "        const log = await globalThis.__stepWorld(days);",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
