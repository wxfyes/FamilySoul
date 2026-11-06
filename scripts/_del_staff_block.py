import io
p = 'src/pet-service.js'
s = io.open(p, encoding='utf-8-sig').read()
# 删掉旧的 8.81 护院集合块（与新入口重复，且一次拉 24 人）
start = s.find("    // 8.81 相公叫护院/家丁")
end = s.find("    // 8.82", start)
if start > 0 and end > start:
    s = s[:start] + s[end:]
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('删旧护院块')
else:
    print('未找到旧块', start, end)
