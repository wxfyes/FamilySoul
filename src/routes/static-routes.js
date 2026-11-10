/**
 * 静态资源与看板大屏托管路由
 */

import fs from 'node:fs';
import path from 'node:path';
import { sendJson } from '../middleware/http-utils.js';

export function handleStaticRoutes(req, res, { pathname, rootDir, avatarDir }) {
  const WEB_INDEX_FILE = path.join(rootDir, 'web', 'index.html');
  const WEB_DASH_FILE = path.join(rootDir, 'web', 'dashboard.html');
  const isHtmlWanted = req.headers.accept && req.headers.accept.includes('text/html');

  // 1. 看板大屏
  if ((pathname === '/dashboard' || pathname === '/dashboard.html') && fs.existsSync(WEB_DASH_FILE)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    fs.createReadStream(WEB_DASH_FILE).pipe(res);
    return true;
  }

  // 2. Web 控制台主页
  if ((pathname === '/' || pathname === '/index.html' || pathname === '/admin') && isHtmlWanted) {
    if (fs.existsSync(WEB_INDEX_FILE)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(WEB_INDEX_FILE).pipe(res);
      return true;
    }
  }

  // 3. Web 静态子资源（如 /web/xxx.jpg, /web/xxx.png）
  if (pathname.startsWith('/web/')) {
    const safePath = path.normalize(pathname.replace(/^\/web\//, '')).replace(/^(\.\.[\/\\])+/, '');
    const targetFile = path.join(rootDir, 'web', safePath);
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      const ext = path.extname(targetFile).toLowerCase();
      const mimeMap = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
      };
      res.writeHead(200, {
        'Content-Type': mimeMap[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(targetFile).pipe(res);
      return true;
    }
  }

  // 4. 头像媒体读取 GET /dsh-surfcore/pet-api/avatar/:file
  const avatarFileMatch = pathname.match(/^\/dsh-surfcore\/pet-api\/avatar\/([a-zA-Z0-9_]+)\.(jpg|png)$/i);
  if (req.method === 'GET' && avatarFileMatch) {
    const file = path.join(avatarDir, `${avatarFileMatch[1]}.${avatarFileMatch[2].toLowerCase()}`);
    if (!fs.existsSync(file)) {
      sendJson(res, 404, { ok: false, error: '头像不存在' });
      return true;
    }
    const ext = avatarFileMatch[2].toLowerCase();
    res.writeHead(200, {
      'Content-Type': ext === 'png' ? 'image/png' : 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(file).pipe(res);
    return true;
  }

  return false;
}

