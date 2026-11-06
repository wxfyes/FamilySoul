import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'BUILD_TAG_20261106B' not in s:
    s = s.replace("const PORT = Number(process.env.PORT) || config.port || 3088;",
                  "console.log('BUILD_TAG_20261106B');\n\nconst PORT = Number(process.env.PORT) || config.port || 3088;", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('marker')
