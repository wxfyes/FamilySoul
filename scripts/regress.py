import io, os, subprocess, sys, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

CASES = []


def case(name):
    def deco(fn):
        CASES.append((name, fn))
        return fn
    return deco


def run_node(code, timeout=120):
    path = '.tmp_regress_case.mjs'
    io.open(path, 'w', encoding='utf-8').write(code)
    try:
        r = subprocess.run(['node', path], capture_output=True, text=True, encoding='utf-8', timeout=timeout)
        return (r.stdout or '') + (r.stderr or '')
    finally:
        if os.path.exists(path):
            os.remove(path)


HEAD = r'''
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PetService } from './src/pet-service.js';
const root = path.join(os.tmpdir(), 'fs-reg-' + Date.now());
const dir = path.join(root, 'data');
fs.mkdirSync(path.join(dir, 'world'), { recursive: true });
fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ family: { husband:{token:'h'}, liuwenxia:{token:'l', actor:'liuwenxia'} } }), 'utf8');
const { loadState, saveState, ensureCities, ensureCourt } = await import('./src/world/state.js');
const { applyWorldTags } = await import('./src/world/dispatch.js');
const { tick } = await import('./src/world/clock.js');
let w = loadState(dir); ensureCities(w); ensureCourt(w);
w.actors.liuwenxia = { id:'liuwenxia', name:'紫嫣', role:'老板娘', gender:'female', home:'wine_shop', location:'street', relations:{husband:{trust:80,desire:60,fear:0,grievance:0}}, schedule:[] };
w.actors.husband.location = 'tea_house';
w.assets.silver = 300;
w.assets.properties = [{ id:'p1', name:'运河码头三层大酒楼', incomePerDay: 8, keeper:'husband', city:'临江府', staff: 3 }];
saveState(dir, w);
const mkLlm = (reply='【阿吉】：嗯。', proxy='') => ({ isReady: () => true, complete: async (a) => {
  if (proxy && a.maxTokens >= 150 && a.maxTokens <= 300) return { text: proxy, usage: null };
  if (a.maxTokens <= 200) return { text: '[[world:none]]', usage: null };
  return { text: reply, usage: null };
}});
'''

TAIL = r'''
fs.rmSync(root, { recursive: true, force: true });
'''


@case('她回家 → 只动她自己')
def c1():
    out = run_node(HEAD + r'''
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: mkLlm(), ttsService:null, visionService:null, dataDir: dir });
await svc.chat({ text: '回家', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
const s = loadState(dir);
console.log(s.actors.liuwenxia.location === 'wine_shop' && s.actors.husband.location === 'tea_house' ? 'PASS' : 'FAIL 她=' + s.actors.liuwenxia.location + ' 他=' + s.actors.husband.location);
''' + TAIL)
    return 'PASS' in out, out


@case('记账员不能搬相公')
def c2():
    out = run_node(HEAD + r'''
applyWorldTags(dir, [{ kind:'move', args:{ who:'husband', to:'street' } }], { selfId:'liuwenxia' });
const s = loadState(dir);
console.log(s.actors.husband.location === 'tea_house' ? 'PASS' : 'FAIL 他=' + s.actors.husband.location);
''' + TAIL)
    return 'PASS' in out, out


@case('隔空找王甯仍能应声')
def c3():
    out = run_node(HEAD + r'''
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: mkLlm('【阿吉】：嗯。', '在，我在茶坊。'), ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '王掌柜在吗', modality:'text', profileKey:'liuwenxia', roleName:'x', actorId:'liuwenxia' });
console.log(String(r.reply?.text||'').includes('王甯') ? 'PASS' : 'FAIL ' + String(r.reply?.text||'').slice(0,30));
''' + TAIL)
    return 'PASS' in out, out


@case('府中人名单注入')
def c4():
    out = run_node(HEAD + r'''
w.actors.waner.location = 'tea_house';
saveState(dir, w);
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: mkLlm(), ttsService:null, visionService:null, dataDir: dir });
await svc.chat({ text: '婉儿', modality:'text', profileKey:'husband', roleName:'x', actorId:null });
console.log('PASS');
''' + TAIL)
    return 'BONDS] 府中人' in out.upper() or '府中人' in out, out


@case('点了谁只留谁（婉儿不插嘴）')
def c5():
    out = run_node(HEAD + r'''
w.actors.suniang = { id:'suniang', name:'苏娘', role:'绣坊寡妇', gender:'female', home:'street', location:'street', relations:{husband:{trust:18}}, schedule:[] };
w.actors.suniang.location = 'street';
saveState(dir, w);
const svc = new PetService({ rolesManager:{ getActiveRole:()=>'x', getRolePersona:()=>'x', listRoles:()=>[] }, llmClient: mkLlm('【苏娘】：哟。\\n【沈婉儿】：相公。'), ttsService:null, visionService:null, dataDir: dir });
const r = await svc.chat({ text: '苏娘', modality:'text', profileKey:'husband', roleName:'x', actorId:null });
const t = String(r.reply?.text||'');
console.log(t.includes('沈婉儿') ? 'FAIL 婉儿插嘴' : 'PASS');
''' + TAIL)
    return 'PASS' in out, out


@case('国库日结不亏空')
def c6():
    out = run_node(HEAD + r'''
const t0 = Date.now();
for (let i=1;i<=3;i++) tick(dir, { now: t0 + i*24*3600*1000, msPerWorldHour: 3600*1000 });
const s = loadState(dir);
const tr = s.court?.treasury || {};
console.log(Number(tr.silver) >= 0 && Number(tr.lastIncome) > 0 ? 'PASS 银=' + Math.round(tr.silver) : 'FAIL ' + JSON.stringify(tr));
''' + TAIL)
    return 'PASS' in out, out


@case('关系网不爆炸')
def c7():
    out = run_node(HEAD + r'''
let n = 0; const seen = new Set();
for (const [a, m] of Object.entries(w.bonds||{})) for (const b of Object.keys(m||{})) { const k=a<b?a+'|'+b:b+'|'+a; if(!seen.has(k)){seen.add(k);n++;} }
console.log(n < 1500 ? 'PASS ' + n + '条' : 'FAIL ' + n + '条');
''' + TAIL)
    return 'PASS' in out, out


@case('正房别名可用')
def c8():
    out = run_node(HEAD + r'''
const { applySummon } = await import('./src/world/summon.js');
applySummon(dir, '回房', '', 'husband');
const s = loadState(dir);
console.log(s.actors.husband.location === 'husband_room' ? 'PASS' : 'FAIL ' + s.actors.husband.location);
''' + TAIL)
    return 'PASS' in out, out


@case('案子能立卷并排开庭')
def c9():
    out = run_node(HEAD + r'''
w.actors.suniang = w.actors.suniang || { id:'suniang', name:'苏娘', role:'绣坊寡妇', gender:'female', home:'street', location:'street', relations:{husband:{trust:18}}, schedule:[] };
saveState(dir, w);
applyWorldTags(dir, [{ kind:'report', args:{ who:'suniang', against:'husband', claim:'赖账不还' } }], { selfId:'husband' });
const s = loadState(dir);
const c = (s.cases||[])[0];
console.log(c && c.status === 'summoned' && c.hearDay ? 'PASS' : 'FAIL ' + JSON.stringify(c));
''' + TAIL)
    return 'PASS' in out, out


@case('造人给落脚处')
def c10():
    out = run_node(HEAD + r'''
applyWorldTags(dir, [{ kind:'spawn', args:{ name:'柳三娘', role:'卖花婆子' } }], { selfId:'husband' });
const s = loadState(dir);
const a = Object.values(s.actors).find((x) => x.name === '柳三娘');
console.log(a ? 'PASS ' + (s.places[a.location]?.name || '') : 'FAIL');
''' + TAIL)
    return 'PASS' in out, out


def main():
    passed = failed = 0
    for name, fn in CASES:
        try:
            ok, out = fn()
        except Exception as e:
            ok, out = False, str(e)
        mark = '✅' if ok else '❌'
        print(f'{mark} {name}')
        if not ok:
            print('   ' + (out or '').strip().replace('\n', ' | ')[:220])
            failed += 1
        else:
            passed += 1
    print(f'\n通过 {passed} / {passed + failed}')
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
