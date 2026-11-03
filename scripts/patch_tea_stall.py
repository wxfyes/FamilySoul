import io

# 1. patch dispatch.js
p_disp = 'src/world/dispatch.js'
s_disp = io.open(p_disp, encoding='utf-8').read()

target_disp = """  if (/(县衙|衙门|公堂|后堂|县衙后堂|后院|县衙后院|偏厅|正堂|大堂|衙内)/.test(raw) && !/(牢|狱)/.test(raw)) {
    if (world.places?.yamen) return 'yamen';
  }"""

replacement_disp = """  if (/(茶摊|小茶摊|茶棚|县衙茶摊|街边茶摊|县衙前茶摊)/.test(raw)) {
    if (world.places?.tea_stall) return 'tea_stall';
  }
  if (/(县衙|衙门|公堂|后堂|县衙后堂|后院|县衙后院|偏厅|正堂|大堂|衙内)/.test(raw) && !/(牢|狱)/.test(raw)) {
    if (world.places?.yamen) return 'yamen';
  }"""

s_norm = s_disp.replace('\r\n', '\n')
target_norm = target_disp.replace('\r\n', '\n')
replacement_norm = replacement_disp.replace('\r\n', '\n')

if target_norm in s_norm:
    s_norm = s_norm.replace(target_norm, replacement_norm, 1)
    if '\r\n' in s_disp:
        s_norm = s_norm.replace('\n', '\r\n')
    io.open(p_disp, 'w', encoding='utf-8').write(s_norm)
    print('patch dispatch.js: success')
else:
    print('patch dispatch.js: not found')

# 2. patch state.js
p_state = 'src/world/state.js'
s_state = io.open(p_state, encoding='utf-8').read()

target_state = "    noodle_stall: { name: '王婆面摊', exits: ['street'], owner: 'wangpo', kind: '面摊' },"
replacement_state = """    noodle_stall: { name: '王婆面摊', exits: ['street'], owner: 'wangpo', kind: '面摊' },
    tea_stall: { name: '县衙前茶摊', exits: ['yamen', 'street'], owner: 'public', kind: '茶摊' },"""

target_clean = "// 1. 确保核心场所齐整"
replacement_clean = """// 1. 确保核心场所齐整
    if (!world.places?.tea_stall) {
      world.places = world.places || {};
      world.places.tea_stall = { name: '县衙前茶摊', exits: ['yamen', 'street'], owner: 'public', kind: '茶摊' };
    }"""

s_norm2 = s_state.replace('\r\n', '\n')
if target_state in s_norm2:
    s_norm2 = s_norm2.replace(target_state, replacement_state, 1)
if target_clean in s_norm2:
    s_norm2 = s_norm2.replace(target_clean, replacement_clean, 1)

if '\r\n' in s_state:
    s_norm2 = s_norm2.replace('\n', '\r\n')
io.open(p_state, 'w', encoding='utf-8').write(s_norm2)
print('patch state.js: success')
