import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8').read()

# ---------- ① 人物表：彻底排除官员（不只是 officeHolders） ----------
old_filter = """  const officialIds = new Set(w.officeHolders || []);
  const list = (w.actors||[])
    .filter((a) => a && !officialIds.has(a.id))"""
new_filter = """  const officialIds = new Set(w.officeHolders || []);
  // 官员一律只进「朝中」卡，不进人物表（按 id 与身份双重判定）
  const OFFICIAL_ROLE_RE = /知县|知府|尚书|侍郎|巡抚|宰相|天子|御史|总督|按察|布政|通判|典史|主簿|县令|县丞|知州|同知|参军|都尉|统领/;
  const isOfficial = (a) => officialIds.has(a.id) || OFFICIAL_ROLE_RE.test(String(a.role || ''));
  const list = (w.actors||[])
    .filter((a) => a && !isOfficial(a))"""
if old_filter in s:
    s = s.replace(old_filter, new_filter, 1)
    print('① 人物表已排除全部官员')
else:
    print('WARN: 人物表过滤段没找到')

# ---------- ② 朝中卡：每个官后面带 信/怨/欲 ----------
old_label = """  const labelOf = (o) => {
    const actor = o.holder ? (w.actors || []).find(a => a.id === o.holder) : null;
    return !o.holder ? '<span class="bad">空缺</span>' : (actor ? actor.name : o.holder + '（未入世）');
  };"""
new_label = """  const labelOf = (o) => {
    const actor = o.holder ? (w.actors || []).find(a => a.id === o.holder) : null;
    if (!o.holder) return '<span class="bad">空缺</span>';
    if (!actor) return o.holder + '（未入世）';
    const r = actor.relations || {};
    const t = Number(r.trust) || 0;
    const g = Number(r.grievance) || 0;
    const d = Number(r.desire) || 0;
    return `${actor.name} <span class="muted" style="font-size:11px">信${t} 怨${g} 欲${d}</span>`;
  };"""
if old_label in s:
    s = s.replace(old_label, new_label, 1)
    print('② 朝中卡已显示 信/怨/欲')
else:
    print('WARN: labelOf 没找到')

io.open(p, 'w', encoding='utf-8').write(s)
print('done')
