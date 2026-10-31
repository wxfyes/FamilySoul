import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROLES_DIR = path.resolve(__dirname, '../roles');

export class RolesManager {
  constructor(activeRole = '傲娇助手') {
    this.activeRole = activeRole;
  }

  getActiveRole() {
    return this.activeRole;
  }

  setActiveRole(roleName) {
    const roles = this.listRoles();
    if (roles.includes(roleName)) {
      this.activeRole = roleName;
      return true;
    }
    return false;
  }

  listRoles() {
    try {
      if (!fs.existsSync(ROLES_DIR)) return ['傲娇助手'];
      return fs.readdirSync(ROLES_DIR)
        .filter(f => f.endsWith('.md') && f !== 'README.md')
        .map(f => f.replace(/\.md$/, ''));
    } catch {
      return ['傲娇助手'];
    }
  }

  getRolePersona(roleName = this.activeRole) {
    const filePath = path.join(ROLES_DIR, `${roleName}.md`);
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8').trim();
      }
    } catch (_) {}
    return '';
  }
}
