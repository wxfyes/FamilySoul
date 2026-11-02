import io

p = 'web/dashboard.html'
s = io.open(p, encoding='utf-8-sig').read()

# ① 弹层容器
if 'id="actorModal"' not in s:
    s = s.replace(
        "</body>",
        "<div id=\"actorModal\" style=\"display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99\" onclick=\"if(event.target===this)closeActor()\">\n"
        "  <div style=\"max-width:560px;margin:6vh auto;background:#161a21;border:1px solid #2a2f3a;border-radius:12px;padding:18px;max-height:82vh;overflow:auto\">\n"
        "    <div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:8px\">\n"
        "      <b id=\"amName\" style=\"font-size:16px\"></b>\n"
        "      <a href=\"javascript:void(0)\" onclick=\"closeActor()\" style=\"color:#888\">关闭</a>\n"
        "    </div>\n"
        "    <div id=\"amBody\" style=\"font-size:13px;line-height:1.7\"></div>\n"
        "  </div>\n"
        "</div>\n"
        "</body>",
        1,
    )
    print('added modal container')

# ② 行可点
s = s.replace(
    "    return `<tr>\n      <td><b>${a.name}</b></td>",
    "    return `<tr style=\"cursor:pointer\" onclick=\"openActor('${a.id}')\">\n      <td><b>${a.name}</b></td>",
    1,
)

# ③ 打开/渲染
if 'function openActor' not in s:
    fn = (
        "async function openActor(id) {\n"
        "  const tk = token();\n"
        "  if (!tk || !id) return;\n"
        "  try {\n"
        "    const r = await fetch(`/api/admin/actor/detail?token=${encodeURIComponent(tk)}&id=${encodeURIComponent(id)}`);\n"
        "    const j = await r.json();\n"
        "    if (!j.ok) return;\n"
        "    const a = j.actor || {};\n"
        "    $('amName').textContent = `${a.name}　${a.role || ''}`;\n"
        "    const rel = a.rel || {};\n"
        "    const bonds = (j.bonds || []).map((b) => `${b.name}（${b.type}·${b.score > 0 ? '亲' : '疏'}）`).join('　') || '—';\n"
        "    const cases = (j.cases || []).map((c) => `${c.role}·${c.claim}（${c.status}${c.reason ? '·' + c.reason : ''}）`).join('<br>') || '无案底';\n"
        "    const props = (j.props || []).map((p) => `${p.name}（${p.role}·日入${Number(p.income).toFixed(2)}·${p.staff}人）`).join('<br>') || '—';\n"
        "    const knows = (j.knows || []).join('<br>') || '—';\n"
        "    const arc = j.arc ? (j.arc.lastStep || (j.arc.log && j.arc.log.length ? j.arc.log[j.arc.log.length - 1].text : '') || '') : '';\n"
        "    $('amBody').innerHTML = `\n"
        "      <div>${a.origin === 'spawned' ? '天道衍生' : '预设'}　${a.gender === 'male' ? '男' : '女'}　在「${a.place || '不知去向'}」${a.activity ? '，' + a.activity : ''}</div>\n"
        "      ${a.dead ? '<div style=\"color:#e05a5a\">已故</div>' : ''}\n"
        "      ${a.jailed ? `<div style=\"color:#e0a05a\">在押（第${a.jailed.untilDay}日出狱）</div>` : ''}\n"
        "      ${rel && rel.trust != null ? `<div>对相公：信任 ${rel.trust}　欲望 ${rel.desire || 0}　怨怼 ${rel.grievance || 0}</div>` : ''}\n"
        "      <div>身上：${Number(j.money || 0).toFixed(2)} 两${a.rank ? '　功名：' + a.rank : ''}${a.study ? '　学识：' + a.study : ''}</div>\n"
        "      <div style=\"margin-top:6px\"><b>关系</b><br>${bonds}</div>\n"
        "      ${a.goals && a.goals.length ? `<div style=\"margin-top:6px\"><b>想做的事</b><br>${a.goals.join('；')}</div>` : ''}\n"
        "      ${a.secret ? `<div style=\"margin-top:6px\"><b>秘密</b><br>${a.secret}</div>` : ''}\n"
        "      ${arc ? `<div style=\"margin-top:6px\"><b>眼下</b><br>${arc}</div>` : ''}\n"
        "      <div style=\"margin-top:6px\"><b>案底</b><br>${cases}</div>\n"
        "      <div style=\"margin-top:6px\"><b>产业</b><br>${props}</div>\n"
        "      <div style=\"margin-top:6px\"><b>听过的风评</b><br>${knows}</div>`;\n"
        "    $('actorModal').style.display = 'block';\n"
        "  } catch (e) { /* 忽略 */ }\n"
        "}\n"
        "function closeActor() { $('actorModal').style.display = 'none'; }\n\n"
    )
    s = s.replace("function renderWorldExtras(", fn + "function renderWorldExtras(", 1)
    print('added openActor')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
