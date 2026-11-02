import io

p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()

# ① 触发收紧：必须是这一句在叫他/问她，不能因为上一句提过就触发
old = (
    "        const askedHim = /(王甯|王掌柜|少掌柜|相公)/.test(String(say || ''))\n"
    "          || /(王甯|王掌柜|少掌柜)/.test(lastTurns)\n"
    "          || /(你|您)/.test(String(say || ''))\n"
    "          || /(那你|你是谁|谁啊|在吗)/.test(String(say || ''));"
)
new = (
    "        const said = String(say || '');\n"
    "        const askedHim = /(王甯|王掌柜|少掌柜|相公)/.test(said)\n"
    "          || /(你|您)/.test(said)\n"
    "          || /(那你|你是谁|谁啊|在吗)/.test(said);"
)
if old in s:
    s = s.replace(old, new)
    print('patched: tighter proxy trigger')
else:
    print('WARN: trigger block not found')

# ② 问进账：模型没给数字，就用账本事实直接答
anchor = "    // 她一开口就算\"在行动\"，主线不会因为躺平被世界替她定夺"
inject = (
    "    // 问进账：数字必须准确，模型没给就由引擎直接报\n"
    "    try {\n"
    "      if (this._viewerActorId && /(进多少|日入|收入|赚多少|多少钱|几两)/.test(String(say || ''))) {\n"
    "        const wM = loadState(this.dataDir);\n"
    "        const meM = wM.actors?.[this._viewerActorId];\n"
    "        const props = (wM.assets?.properties || []).filter((p) => p && p.keeper === this._viewerActorId);\n"
    "        const daily = props.reduce((sum, p) => sum + (Number(p.incomePerDay) || 0), 0);\n"
    "        const wallet = Number(wM.wallets?.[this._viewerActorId]) || 0;\n"
    "        const nums = String(reply).match(/\\d+(?:\\.\\d+)?/g) || [];\n"
    "        const alreadyRight = nums.some((n) => Math.abs(Number(n) - daily) < 0.01 || Math.abs(Number(n) - wallet) < 0.01);\n"
    "        if (!alreadyRight) {\n"
    "          const placeName = String(wM.places?.[meM?.location]?.name || '这里');\n"
    "          reply = `【${placeName}】：日入${daily.toFixed(2)}两，账上现银${wallet.toFixed(2)}两。`;\n"
    "          console.log('[Money] 引擎直接报数：日入' + daily.toFixed(2) + ' 现银' + wallet.toFixed(2));\n"
    "        }\n"
    "      }\n"
    "    } catch (err) {\n"
    "      console.warn('[Money] 报数失败：', err.message);\n"
    "    }\n\n"
)
if anchor in s and '引擎直接报数' not in s:
    s = s.replace(anchor, inject + anchor, 1)
    print('added deterministic money answer')
else:
    print('WARN: money anchor not found')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
