import io
p = 'src/world/naming.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'isGenericAddress' not in s:
    s = s.replace("export function isPlaceName(name) {",
"""export const GENERIC_ADDRESS = ['掌柜', '东家', '老板', '老板娘', '夫人', '娘子', '小姐', '公子', '老爷', '婆婆', '婶子', '公公', '伙计', '小二', '跑堂', '客官', '大娘子', '先生', '师父'];

/** 这个词是通称还是人名（通称不当人名匹配） */
export function isGenericAddress(word) {
  const w = String(word || '').trim();
  if (!w) return false;
  return GENERIC_ADDRESS.includes(w);
}

export function isPlaceName(name) {""", 1)
    io.open(p, 'w', encoding='utf-8-sig').write(s)
    print('naming 通称表')
