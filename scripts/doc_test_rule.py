import io

p = 'docs/world-completeness.md'
s = io.open(p, encoding='utf-8').read()

if '测试数据不许进生产' not in s:
    s += (
        "\n\n---\n\n"
        "## 铁规：测试数据不许进生产\n\n"
        "- 所有验收测试一律在临时目录（`os.tmpdir`）里跑，**绝不往生产 `state.json` 写测试数据**\n"
        "- 若已误写：用管理接口清除（`/api/admin/case/remove`、`/api/admin/todo/remove`、`/api/admin/actor/delete`），并在日志里留一行说明\n"
        "- 每加一个写接口，都要能回答：这条数据是谁写的、什么时候写的、怎么撤\n"
    )
    print('added rule')

io.open(p, 'w', encoding='utf-8').write(s)
