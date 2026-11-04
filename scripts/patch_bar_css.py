with open('web/dashboard.html', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. 增加 CSS .bar
old_table_css = "td.num { font-variant-numeric: tabular-nums; }"
new_table_css = """td.num { font-variant-numeric: tabular-nums; }

  /* 📊 人物数值进度条 (信任/欲望/怨怼) */
  .bar {
    height: 5px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
    min-width: 48px;
    max-width: 72px;
    margin-top: 3px;
  }
  .bar i {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .bar i.trust {
    background: linear-gradient(90deg, #059669, #10b981);
  }
  .bar i.desire {
    background: linear-gradient(90deg, #db2777, #f43f5e);
  }
  .bar i.grievance {
    background: linear-gradient(90deg, #7c3aed, #ef4444);
  }"""

if old_table_css in c:
    c = c.replace(old_table_css, new_table_css)
    print("Added .bar CSS successfully!")
else:
    print("Could not find old_table_css!")

# 2. 增强 JS bar 函数，支持分类颜色
old_bar_code = "const bar = v => `<div class=\"bar\"><i style=\"width:${Math.max(0,Math.min(100,v))}%\"></i></div>`;"
new_bar_code = "const bar = (v, cls = '') => `<div class=\"bar\"><i class=\"${cls}\" style=\"width:${Math.max(0,Math.min(100,v))}%\"></i></div>`;"

if old_bar_code in c:
    c = c.replace(old_bar_code, new_bar_code)
    print("Updated bar function!")
else:
    print("Could not find old_bar_code!")

# 3. 增强 td.num 输出
old_td_num = """      <td class="num">${r.trust??'—'} ${bar(r.trust||0)}</td>
      <td class="num">${r.desire??'—'} ${bar(r.desire||0)}</td>
      <td class="num">${r.grievance??0} ${bar(r.grievance||0)}</td>"""

new_td_num = """      <td class="num">${r.trust??'—'} ${bar(r.trust||0, 'trust')}</td>
      <td class="num">${r.desire??'—'} ${bar(r.desire||0, 'desire')}</td>
      <td class="num">${r.grievance??0} ${bar(r.grievance||0, 'grievance')}</td>"""

if old_td_num in c:
    c = c.replace(old_td_num, new_td_num)
    print("Updated td.num table cells with colored bars!")
else:
    print("Could not find old_td_num!")

with open('web/dashboard.html', 'w', encoding='utf-8') as f:
    f.write(c)
print("Finished patching .bar in web/dashboard.html")

