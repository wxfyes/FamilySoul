async function healMagistrate() {
  const token = 'wxf_husband_exclusive_token_2026';
  const r = await fetch('http://192.168.1.254:3088/api/admin/history/read?token=' + token + '&member=husband');
  const d = await r.json();
  const msgs = d.messages || [];

  const map = {
    '小的佩服': '【知县·文达】：王少掌柜这般正经经营，卖艺不卖身、开月钱立契约，本官倒是赞赏。既是如此，那歌娘舞娘的名册、月钱、契纸都得备齐，将来官府查验，一翻账便清白。本官回头叫人替你立个章程： 诗会每旬一场，歌舞只在雅间助兴，一概不入客房。这路子要走长久，就凭这一条“正经”二字立得住。',
    '小的哪敢推辞': '【知县·文达】：少掌柜做东相请，老夫便饮了这一杯。只是有句公道话得先搁在这儿，这楼里的歌娘舞娘，月钱、契纸、名册都得齐整，本官才能在官面上替你立住“正经”二字。改日若巡按御史打发人来查，一翻账一验契，清白便成了临江的招牌。',
    '东家这话问得小的汗都出来了': '【知县·文达】：少掌柜既请本官掌眼，本官便直言： 歌娘舞娘的名册、月钱、契纸，一样不能缺；雅间只供诗酒听曲，不入客房，这规矩得白纸黑字立下来，贴在柜台后头。官面来查只认这一本清白账。少掌柜且宽坐，先饮此杯，章程立稳才是要紧。',
    '东家这话小的接下了': '【知县·文达】：少掌柜这话在理。不过做见证不比说虚话，得有凭据。本官着县衙把今日验看的章程、名册、契纸誊成公文，盖上临江县衙的大印关防，交由少掌柜收在柜上。往后若有哪个不长眼的刁民行商敢无端诬告，少掌柜把这公文往公堂上一递，本官高坐堂上自会秉公明断！来，老夫与你干了这杯。',
    '东家痛快，小的也干': '【知县·文达】：少掌柜痛快！说句交底的官场话，这楼里要立住“正经”二字，光靠今日这一验还不够，得有妥当人真管着。少掌柜若还没定下掌柜，老夫倒可荐一人，乃县衙书办出身，姓钱，熟稔律令与钱谷账目。有他替你掌账，歌娘舞娘的契纸、月钱、名册皆出不了岔子，往后巡按也挑不出毛病。'
  };

  let count = 0;
  for (const m of msgs) {
    for (const [k, v] of Object.entries(map)) {
      if (m.text && m.text.includes(k)) {
        m.text = v;
        count++;
      }
    }
  }

  console.log('Replaced count:', count);
  if (count > 0) {
    const res = await fetch('http://192.168.1.254:3088/api/admin/history/restore?token=' + token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member: 'husband', messages: msgs })
    });
    console.log('Restore result:', await res.json());
  }
}
healMagistrate();

