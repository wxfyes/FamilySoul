/**
 * 成员身份识别与多 Token 鉴权中间件
 */

import fs from 'node:fs';
import { markHumanSeen } from '../world/presence.js';

export const MEMBER_LAST_SEEN = new Map();
export const HUMAN_ONLINE_MS = 2 * 60 * 1000;

export function touchMember(key) {
  if (key) MEMBER_LAST_SEEN.set(key, Date.now());
}

export function getLockedToken(config, lockFile) {
  if (config.token && String(config.token).trim()) {
    return String(config.token).trim();
  }
  try {
    if (fs.existsSync(lockFile)) {
      const saved = fs.readFileSync(lockFile, 'utf8').trim();
      if (saved) return saved;
    }
  } catch (_) {}
  return '';
}

export function lockHusbandToken(incomingToken, config, lockFile) {
  const tokenStr = String(incomingToken || '').trim();
  if (!tokenStr) return;
  try {
    fs.writeFileSync(lockFile, tokenStr, 'utf8');
    config.token = tokenStr;
    console.log('[Auth] 成功锁定相公专属通行证，从此唯相公一人可入闺房！');
  } catch (_) {}
}

export function getFamilyProfiles(config, lockFile) {
  const husbandToken = String(config.token || getLockedToken(config, lockFile) || 'wxf_husband_exclusive_token_2026').trim();
  const defaults = {
    husband: {
      key: 'husband',
      token: husbandToken,
      role: '傲娇助手',
      title: '天命相公 · 王甯',
      presence: '临江少掌柜 · 执掌乾坤',
      description: '江南临江茶坊少掌柜 · 运河大酒楼东家',
    },
    wife: {
      key: 'wife',
      token: 'wife_exclusive_token_8888',
      role: '贴心管家',
      title: '贴心大管家',
      presence: '随时为女主人效劳',
      description: '女主人的专属管家与知心好友',
    },
    kid: {
      key: 'kid',
      token: 'kid_exclusive_token_9999',
      role: '全能导师',
      title: '全能探索导师',
      presence: '陪伴小学霸探索世界',
      description: '孩子的学霸大哥哥兼探索导师',
    },
  };

  if (config.family && typeof config.family === 'object') {
    const result = {
      husband: { ...defaults.husband, ...(config.family.husband || {}) },
      wife: { ...defaults.wife, ...(config.family.wife || {}) },
      kid: { ...defaults.kid, ...(config.family.kid || {}) },
    };
    for (const [k, v] of Object.entries(config.family)) {
      if (!result[k] && v && typeof v === 'object') {
        result[k] = {
          key: k,
          token: String(v.token || '').trim(),
          role: v.role || '贴心管家',
          title: v.title || k,
          presence: v.presence || '随时在线陪伴',
          description: v.description || '自定义受邀成员 / 知心挚友',
          actor: v.actor || (k !== 'husband' && k !== 'wife' && k !== 'kid' ? k : null) || (/紫嫣|文霞/.test(String(v.title || '')) ? 'liuwenxia' : null),
        };
      }
    }
    return result;
  }
  return defaults;
}

export function resolveMember(req, url, { config, lockFile, userRegistry } = {}) {
  const headerToken = String(req.headers['x-pet-token'] || '').trim();
  const queryToken = String(url.searchParams.get('token') || '').trim();
  const clientToken = headerToken || queryToken;

  if (!clientToken) return null;

  const family = getFamilyProfiles(config, lockFile);
  for (const [memberKey, profile] of Object.entries(family)) {
    if (profile.token && profile.token === clientToken) {
      touchMember(memberKey);
      if (profile.actor) markHumanSeen(profile.actor);
      return { ...profile, memberKey };
    }
  }

  // 兼容未固定配置时的首次主权相公接入
  const locked = getLockedToken(config, lockFile);
  if (!locked && !config.token) {
    lockHusbandToken(clientToken, config, lockFile);
    markHumanSeen('husband');
    return { ...family.husband, token: clientToken, memberKey: 'husband' };
  }

  // 检查已自建档案入世的普通玩家身份（data/users.json）
  if (userRegistry) {
    const regUser = userRegistry.getUserByToken(clientToken);
    if (regUser) {
      touchMember(regUser.actorId);
      markHumanSeen(regUser.actorId);
      return {
        memberKey: regUser.actorId,
        actor: regUser.actorId,
        title: regUser.name,
        name: regUser.name,
        token: regUser.token,
        role: regUser.role || '布衣',
        isRegisteredPlayer: true,
      };
    }
  }

  return null;
}

