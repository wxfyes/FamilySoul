import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
start = s.find("    // 8.81 相公叫护院")
if start < 0:
    # 用块内特征反推起始：向上找最近的注释行
    idx = s.find("const callStaff = /(护院|家丁|私兵)")
    start = s.rfind("    //", 0, idx)
end = s.find("    // 8.82", start)
if start > 0 and end > start:
    s = s[:start] + s[end:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('删旧护院块', start, end)
else:
    print('定位失败', start, end)
