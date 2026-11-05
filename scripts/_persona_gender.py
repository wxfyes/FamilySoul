import io

# ============ ① 性别推断：unknown 不能留 ============
p = 'src/world/persona.js'
s = io.open(p, encoding='utf-8-sig').read()
if 'inferGenderFromIdentity' not in s:
    s = s.replace("/** 姓名 + 身份 一起看，推一个合乎世情的岁数 */", """/** 性别：名字与身份都看不出女性特征，就当男子（绝不留 unknown） */
export function inferGenderFromIdentity(name = '', role = '', fallback = 'male') {
  const text = `${name} ${role}`;
  if (/[娘婆姑嫂妹姐氏妇母女妮媛嫣娟婷妍嫦娥姬妃嫔]/.test(String(name || ''))) return 'female';
  if (/丫鬟|丫头|侍女|婆子|妇人|寡妇|稳婆|媒婆|绣娘|尼|婢|妾|公主|王妃|太太|小姐|姑娘/.test(text)) return 'female';
  if (/[公郎爷叔伯先生]*/.test('') && /先生|郎君|公子|老爷|少爷|和尚|道士|僧|侠|镖师|捕快/.test(text)) return 'male';
  return fallback;
}

/** 姓名 + 身份 一起看，推一个合乎世情的岁数 */""")
    print('① 加性别推断')

# 婚配：分性别、分年龄，年轻人多未婚，三十以上多已婚；男的单身高龄少
old = """  const a = num(age);
  if (a >= 45) {
    // 长者：四成孀居，六成老伴在堂（按名字定，稳定不随机）
    return (String(name).length % 10 < 4) ? 'widowed' : 'married';
  }
  if (a >= 24) return 'married';
  if (/丫鬟|丫头|姑娘|少女/.test(text) || a < 20) return 'single';
  return 'married';"""
new = """  const a = num(age);
  const g = String(gender || 'female');
  const seed = String(name || '').length;

  // 长者：四成孀居、六成老伴在堂
  if (a >= 45) return (seed % 10 < 4) ? 'widowed' : 'married';

  // 三十以上：大多已婚（少数寡居）
  if (a >= 30) return (seed % 10 < 1) ? 'widowed' : 'married';

  // 二十四到二十九：一半已婚、一半未许人家（按名字定，稳定不随机）
  if (a >= 24) {
    if (/娘子|嫂|妇人|婶|娘/.test(text)) return 'married';
    return (seed % 10 < 5) ? 'married' : 'single';
  }

  // 十八到二十三：女孩多未出阁；男丁多未娶
  if (a >= 18) {
    if (/娘子|嫂|妇人|婶/.test(text)) return 'married';
    return (seed % 10 < 7) ? 'single' : 'married';
  }

  // 十八以下：除非已有婚约（丫头/通房），一律未婚
  if (/通房|侍妾|妾/.test(text)) return 'concubine';
  return 'single';"""
if old in s:
    s = s.replace(old, new, 1)
    print('② 婚配按年纪与性别分层')

# 男的单身高龄用"未娶"，不叫待字闺中
old2 = """    case 'single': return '未婚 · 待字闺中';"""
new2 = """    case 'single': return a.gender === 'male' ? '未婚 · 尚未娶亲' : '未婚 · 待字闺中';"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print('③ 男子未婚不叫待字闺中')
io.open(p, 'w', encoding='utf-8-sig').write(s)
