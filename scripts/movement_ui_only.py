import io

# ============ ① dispatch：文字回执不许移动人（只有界面能动） ============
p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """        // 真人成员在自己的账号里走动，绝不许顺带把相公搬过去
        const caller = String((opts && (opts.selfId || opts.memberKey)) || '');"""
new = """        // 铁律：移动只由界面发起（点「出门」），聊天里说到去哪只算商量，不许瞬移
        if (!opts || !opts.byUi) {
          applied.push('拒绝:文字不触发移动（要走请点上面的位置条）');
          continue;
        }
        // 真人成员在自己的账号里走动，绝不许顺带把相公搬过去
        const caller = String((opts && (opts.selfId || opts.memberKey)) || '');"""
if old in s:
    s = s.replace(old, new, 1)
    print('① dispatch 拒绝文字移动')
io.open(p, 'w', encoding='utf-8').write(s)

# ============ ② pet-service：聊天不再执行移动（既不动他，也不动她） ============
p2 = 'src/pet-service.js'
d = io.open(p2, encoding='utf-8-sig').read()

# 2a 关掉 summon（走动/开房/回家 全由界面）
old2 = """      const summonResult = applySummon(this.dataDir, say, lastBotSaid, actorId && actorId !== 'husband' ? actorId : 'husband');"""
new2 = """      // 移动改由界面（位置条 → 出门）发起，聊天里不再瞬移
      const summonResult = null;"""
if old2 in d:
    d = d.replace(old2, new2, 1)
    print('② 关闭聊天内 summon')

# 2b 关掉 chat 里的 applyAction 移动
old3 = """      if (intent && intent.verb === VERBS.MOVE && intent.target && !gate?.blocked) {"""
new3 = """      if (false && intent && intent.verb === VERBS.MOVE && intent.target && !gate?.blocked) {"""
if old3 in d:
    d = d.replace(old3, new3, 1)
    print('③ 关闭聊天内 applyAction 移动')

# 2c 给提示：要动就点界面
old4 = "    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界"
new4 = """    // 若相公说到"去某地"，只当商量：告诉天道别写"已经到了"
    try {
      if (/(去|往|到|上|回|进)(一|那|这|[\\u4e00-\\u9fa5]{2,6}(馆|铺|楼|坊|堂|店|院|阁|局|庄|街|巷|客栈|酒楼|茶坊|衙门))/.test(say)) {
        contextHintEarly += '（【规矩】相公说要动身，只是商量；真正动身由他自己在界面上点「出门」。你这轮别写"已经到了某处"，最多写到应声或起身。）\\n';
      }
    } catch { /* 忽略 */ }

    // 将 Gate 门禁客观事实注入为天道推演的刚性阻力边界"""
if old4 in d and '真正动身由他自己在界面上点' not in d:
    d = d.replace(old4, new4, 1)
    print('④ 加"动身请点界面"的规矩')

io.open(p2, 'w', encoding='utf-8').write(d)
print('done')
