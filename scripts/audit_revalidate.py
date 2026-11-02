import io

p = 'src/world/audit.js'
s = io.open(p, encoding='utf-8-sig').read()

old = (
    "  const reply = Array.isArray(world.auditIssues)\n"
    "    ? world.auditIssues.filter((x) => x && (!x.day || today - Number(x.day) <= 1)).slice(-12)\n"
    "    : [];"
)
new = (
    "  const BAD_CITY = /(知|到|是|了|回|去|本|该|官|县|州|这|那|一|两|三)/;\n"
    "  const reply = Array.isArray(world.auditIssues)\n"
    "    ? world.auditIssues\n"
    "      .filter((x) => x && (!x.day || today - Number(x.day) <= 1))\n"
    "      .filter((x) => {\n"
    "        // 按现在的规则重新判一遍：假地名（就是府/到府/张知府）不再报\n"
    "        const m = String(x?.text || '').match(/她提到了「([^」]+)」/);\n"
    "        if (!m) return true;\n"
    "        const name = m[1];\n"
    "        if (!/府$/.test(name)) return true;\n"
    "        return BAD_CITY.test(name) ? false : true;\n"
    "      })\n"
    "      .slice(-12)\n"
    "    : [];"
)
if old in s:
    s = s.replace(old, new, 1)
    print('patched: revalidate stored reply issues')

# 顺手把老账里这些假地名彻底清掉
old2 = "  return {\n    ledger,\n    memory,\n    ownership,\n    reply,"
if old2 in s and 'world.auditIssues = world.auditIssues' not in s:
    s = s.replace(
        "export function auditAll(world) {",
        "export function auditAll(world) {\n"
        "  // 一次性清账：把历史上误报的假地名丢掉\n"
        "  if (Array.isArray(world.auditIssues)) {\n"
        "    world.auditIssues = world.auditIssues.filter((x) => {\n"
        "      const m = String(x?.text || '').match(/她提到了「([^」]+)」/);\n"
        "      if (!m) return true;\n"
        "      if (!/府$/.test(m[1])) return true;\n"
        "      return !/(知|到|是|了|回|去|本|该|官|县|州)/.test(m[1]);\n"
        "    });\n"
        "  }",
        1,
    )
    print('patched: one-time cleanup of fake place claims')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
