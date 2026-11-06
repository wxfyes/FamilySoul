import io
p = 'src/server.js'
s = io.open(p, encoding='utf-8-sig').read()
old = """  if (req.method === 'POST' && matchRoute('/register')) {
    try {
      const body = await parseJsonBody(req, 16 * 1024);"""
new = """  if (req.method === 'POST' && matchRoute('/register')) {
    try {
      // 留个痕：谁在什么时候来注册（排查"客户端没发出去"还是"服务端拒了"）
      console.log(`[Register] 收到注册请求：ua=${String(req.headers?.['user-agent'] || '').slice(0, 60)} token=${url.searchParams.get('token') ? '有' : '无'}`);
      const body = await parseJsonBody(req, 16 * 1024);"""
if old in s and '[Register] 收到注册请求' not in s:
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('① 注册请求留痕')
