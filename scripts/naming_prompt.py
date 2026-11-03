import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

old = "        '挑唆：[[world:bond"
add = (
    "        '起名规范（天道必须遵守）：新人物一律「姓+名/称呼」，2–3 字，姓取常见百家姓（陈、王、李、周、柳、秦…），例如「陈郎中」「柳三娘」「周文达」；严禁用句子、动词、疑问词起名（\"拾啥\"\"什么\"\"收拾\"这类一律不许）。',\n"
    "        '造人规矩：只有剧情里真的出现了一个人（进门、街上遇见、被人提起且需要登场），才许 spawn；给身份、给去处、给一句眼下在做什么；不许为了凑场面空造。',\n"
    "        '造物规矩：铺子/宅子/器物也按人间名字起（\"回春堂药铺\"\"聚宝赌坊\"），不许拿半句话当招牌。',\n"
    "        '挑唆：[[world:bond"
)
if old in s and '起名规范（天道必须遵守）' not in s:
    s = s.replace(old, add, 1)
    print('added naming/creation rules to prompt')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
