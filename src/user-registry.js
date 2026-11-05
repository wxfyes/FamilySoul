import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadState, saveState, worldDate } from './world/state.js';
import { isPlaceName } from './world/naming.js';

/**
 * 玩家用户注册与入世管理（安全隔离于 config.json 之外）
 * 存储路径：data/users.json
 */

export class UserRegistry {
  constructor({ dataDir = './data' } = {}) {
    this.dataDir = dataDir;
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.eventsFile = path.join(this.dataDir, 'world', 'events.jsonl');
    this._ensureFile();
  }

  _ensureFile() {
    if (!fs.existsSync(this.usersFile)) {
      try {
        fs.writeFileSync(this.usersFile, JSON.stringify({}, null, 2), 'utf8');
      } catch (_) {}
    }
  }

  loadUsers() {
    try {
      if (fs.existsSync(this.usersFile)) {
        return JSON.parse(fs.readFileSync(this.usersFile, 'utf8') || '{}');
      }
    } catch (err) {
      console.warn('[UserRegistry] 读取 users.json 失败:', err.message);
    }
    return {};
  }

  saveUsers(users) {
    try {
      fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2), 'utf8');
    } catch (err) {
      console.warn('[UserRegistry] 保存 users.json 失败:', err.message);
    }
  }

  getUserByToken(token) {
    if (!token) return null;
    const users = this.loadUsers();
    return users[String(token).trim()] || null;
  }

  register({ name, gender = 'male', age = 20, originKind = 'scholar' }) {
    const rawName = String(name || '').trim();
    if (!rawName || rawName.length < 2 || rawName.length > 4 || !/^[\u4e00-\u9fa5]+$/.test(rawName)) {
      return { ok: false, error: '姓名必须为 2~4 个汉字' };
    }
    const numAge = parseInt(age, 10);
    if (Number.isNaN(numAge) || numAge < 14 || numAge > 60) {
      return { ok: false, error: '年龄须在 14 至 60 岁之间' };
    }

    // 虚词规则：两个字全是"只/会/那/个/上/来/什/么"这类虚词，就不是名字
    const FUNCTION_CHARS = new Set('只会那个上来什么不是就可以已经的着了和与我你他她它们这没有在到把被让给对从向为因所但而或且如若虽然很太更最都也还又再才其因此则乃');
    if ([...rawName].every((ch) => FUNCTION_CHARS.has(ch))) {
      return { ok: false, error: '此名不似人名，请取一个有姓氏或雅号的名字' };
    }

    const placeCheck = isPlaceName(rawName);
    if (placeCheck.ok && placeCheck.looksLikePlace) {
      return { ok: false, error: '地名不可作为人物姓名' };
    }

    const safeGender = gender === 'female' ? 'female' : 'male';
    const world = loadState(this.dataDir);

    // 重名检查：不得与现有主要角色及已发用户重名
    const users = this.loadUsers();
    const nameInUsers = Object.values(users).some(u => u && u.name === rawName);
    const nameInActors = Object.values(world.actors || {}).some(a => a && a.name === rawName && !a.dead);
    if (nameInUsers || nameInActors) {
      return { ok: false, error: '此姓名在城中已有人用，请另选雅号' };
    }

    // 生成唯一角色 ID 与安全通行凭证
    const actorId = `usr_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const token = `usr_token_${crypto.randomBytes(16).toString('hex')}`;

    // 身份与初入行当
    const ROLE_MAP = {
      scholar: '求学的生员',
      merchant: '行脚小商客',
      wanderer: '初来乍到的游侠',
    };
    const roleName = ROLE_MAP[originKind] || '初入临江的布衣';
    const genderDesc = safeGender === 'female' ? '坤身女子' : '乾身男子';

    // 一人一座小院：注册时就给他一处住处（不是所有人挤客栈）
    const houseId = `house_${actorId}`;
    world.places = world.places || {};
    if (!world.places[houseId]) {
      const surname = rawName.slice(0, 1);
      world.places[houseId] = {
        id: houseId,
        name: `${rawName}的小院`,
        exits: ['street'],
        owner: actorId,
        residence: true,
        dynamic: true,
        createdDay: world.clock?.day || 1,
      };
      world.dynamicPlaces = world.dynamicPlaces || {};
      world.dynamicPlaces[houseId] = world.places[houseId];
    }

    // 录入世界账本（直接住进自己的小院）
    world.actors[actorId] = {
      id: actorId,
      name: rawName,
      gender: safeGender,
      age: numAge,
      role: roleName,
      label: '新客',
      playerControlled: true,
      humanBound: true,
      home: houseId,
      location: houseId,
      marital: 'single',
      spouse: null,
      residence: { type: 'own', placeId: houseId },
      money: 1.5, // 1.5两碎银起步盘缠（布衣起点，最多1.5两）
      relations: {
        husband: { trust: 0, desire: 0, fear: 0, grievance: 0 },
      },
      intimacy: { level: 1, tone: 0, lastAt: 0 },
      schedule: [
        { at: 8, do: '在客栈大堂用早茶', place: 'inn' },
        { at: 12, do: '在前街漫步采风', place: 'street' },
        { at: 20, do: '回客栈大堂歇息', place: 'inn' },
      ],
    };

    // 给天道主脑注入初见事实记忆，让 NPC 认识这位新面孔
    world.memories = Array.isArray(world.memories) ? world.memories : [];
    world.memories.push({
      id: `mem_${Date.now().toString(36)}`,
      day: world.clock?.day || 1,
      text: `新面孔入城：【${rawName}】（${genderDesc}，春秋${numAge}，${roleName}），初到临江府，落脚在自家小院。`,
      about: [actorId, 'inn'],
      visible: 'public',
      createdAt: Date.now(),
    });

    saveState(this.dataDir, world);

    // 写入事件流 events.jsonl
    try {
      const eventRecord = JSON.stringify({
        at: Date.now(),
        day: world.clock?.day || 1,
        hour: world.clock?.hour || 0,
        type: 'actor_arrival',
        actorId,
        actorName: rawName,
        desc: `新面孔入城：【${rawName}】（${genderDesc}，${numAge}岁），初涉江湖，落脚自家小院。`,
      }) + '\n';
      fs.appendFileSync(this.eventsFile, eventRecord, 'utf8');
    } catch (_) {}

    // 记录用户身份档案
    users[token] = {
      token,
      actorId,
      name: rawName,
      gender: safeGender,
      age: numAge,
      role: roleName,
      createdAt: Date.now(),
    };
    this.saveUsers(users);

    console.log(`[UserRegistry] 新玩家入世：${rawName}（${actorId}），落脚自家小院，天道已建档`);

    return {
      ok: true,
      token,
      actorId,
      name: rawName,
      gender: safeGender,
      age: numAge,
      place: '临江客栈',
    };
  }
}
