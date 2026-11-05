import io
p = 'src/world/warfare.js'
s = io.open(p, encoding='utf-8-sig').read()
# 改成顶部静态导入，函数内直接调用
s = s.replace("import { grainPrice } from './prices.js';", "import { grainPrice } from './prices.js';\nimport { ensureGatekeeper } from './posts.js';", 1)
s = s.replace("""          const { ensureGatekeeper } = await import('./posts.js');
          ensureGatekeeper(world, homeId);""", """          ensureGatekeeper(world, homeId);""", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('改为静态导入')
