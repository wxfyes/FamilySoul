import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
s = s.replace("""            return { name: p.name, income: shown, status: p.status || '', staff: p.staff || 0, city: p.city || '' })),""",
"""            return { name: p.name, income: shown, status: p.status || '', staff: p.staff || 0, city: p.city || '' };
          }),""", 1)
s = s.replace("""          daily: props.reduce((s, p) => s + (Number(p.incomePerDay) || 0), 0),""",
"""          daily: props.reduce((s, p) => {
            const open = ['已开张', '正常营业'].includes(String(p.status || ''));
            const floor = Math.max(0.15, (Number(p.rent || p.monthlyRent) || 0) / 30 * 1.2, (Number(p.staff) || 0) * 0.05);
            return s + (open ? Math.max(Number(p.incomePerDay) || 0, Math.round(floor * 100) / 100) : 0);
          }, 0),""", 1)
io.open(p, 'w', encoding='utf-8-sig').write(s)
print('修尾+日入合计')
