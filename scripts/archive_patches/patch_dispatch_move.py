import io

p = 'src/world/dispatch.js'
s = io.open(p, encoding='utf-8').read()

target = """        // 真人成员在自己的账号里走动，绝不许顺带把相公搬过去
        const caller = String((opts && (opts.selfId || opts.memberKey)) || '');
        if (id === 'husband' && caller && caller !== 'husband') {
          applied.push(`拒绝:${caller}不能移动相公`);
          continue;
        }
        let place = resolvePlace(world, args.to);"""

replacement = """        // 真人成员在自己的账号里走动，绝不许顺带把相公搬过去
        const caller = String((opts && (opts.selfId || opts.memberKey)) || '');
        if (id === 'husband' && caller && caller !== 'husband') {
          applied.push(`拒绝:${caller}不能移动相公`);
          continue;
        }
        let toName = String(args.to || '').trim();
        const localJunk = /^(院中|院子里|庭院|院里|院|屋里|屋中|房中|屋内|屋里头|厅上|堂中|门口|门外|外头|外边|门前|门后|走廊|台阶|梯下|灶房|厨房)$/;
        if (localJunk.test(toName)) {
          applied.push(`忽略局部移动:${toName}`);
          continue;
        }
        let place = resolvePlace(world, args.to);"""

if target in s:
    s = s.replace(target, replacement, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('patch_dispatch_move: success')
else:
    # 尝试规范换行符
    s_norm = s.replace('\r\n', '\n')
    target_norm = target.replace('\r\n', '\n')
    replacement_norm = replacement.replace('\r\n', '\n')
    if target_norm in s_norm:
        s_norm = s_norm.replace(target_norm, replacement_norm, 1)
        if '\r\n' in s:
            s_norm = s_norm.replace('\n', '\r\n')
        io.open(p, 'w', encoding='utf-8').write(s_norm)
        print('patch_dispatch_move: success (normalized)')
    else:
        print('patch_dispatch_move: not found')

