import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """          properties: props.map((p) => ({ name: p.name, income: Number(p.incomePerDay) || 0, status:"""
new = """          properties: props.map((p) => {
            const open = ['已开张', '正常营业'].includes(String(p.status || ''));
            const floor = Math.max(0.15, (Number(p.rent || p.monthlyRent) || 0) / 30 * 1.2, (Number(p.staff) || 0) * 0.05);
            const shown = open ? Math.max(Number(p.incomePerDay) || 0, Math.round(floor * 100) / 100) : 0;
            return { name: p.name, income: shown, status:"""
if old in s:
    s = s.replace(old, new, 1)
    # 补齐右括号：原行后面还有 status: p.status ... })) 需改成 return {...}; })
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('改 properties 映射（需修尾）')
