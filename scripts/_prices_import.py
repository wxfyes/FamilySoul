import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("import { marketSnapshot } from './world/prices.js';",
              "import { marketSnapshot, grainPrice } from './world/prices.js';", 1)
s = s.replace("import { roomPriceAt, propertyPriceAt } from './world/pricing.js';",
              "import { roomPriceAt, propertyPriceAt, priceOf } from './world/pricing.js';", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('补 grainPrice / priceOf 导入')
