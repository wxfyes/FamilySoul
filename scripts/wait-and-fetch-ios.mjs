import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

async function main() {
  const tokenFile = path.join(os.homedir(), '.dsh/surfcore/github_token');
  const token = fs.readFileSync(tokenFile, 'utf8').trim();

  const repo = 'wxfyes/FamilySoul';
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'FamilySoul-Build-Agent',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  console.log('[iOS Auto] 开始监控云端构建流...');

  while (true) {
    const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/build-mobile-ios.yml/runs?per_page=1`, { headers });
    if (!runsRes.ok) {
      console.log(`获取 runs 失败: ${runsRes.status}`);
      await new Promise(r => setTimeout(r, 20000));
      continue;
    }
    const runsData = await runsRes.json();
    const latestRun = runsData.workflow_runs?.[0];
    if (!latestRun) {
      console.log('未找到 run');
      break;
    }

    console.log(`[iOS Auto] Run ID: ${latestRun.id}, 状态: ${latestRun.status}, 结论: ${latestRun.conclusion}`);
    if (latestRun.status === 'completed') {
      if (latestRun.conclusion !== 'success') {
        throw new Error(`构建失败: ${latestRun.conclusion}`);
      }

      const artifactsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${latestRun.id}/artifacts`, { headers });
      const artifactsData = await artifactsRes.json();
      const ipaArtifact = artifactsData.artifacts?.find(a => a.name.includes('iOS'));
      if (!ipaArtifact) {
        throw new Error('未找到 iOS IPA artifact');
      }

      console.log(`[iOS Auto] 下载中: ${ipaArtifact.name} (${(ipaArtifact.size_in_bytes / 1024 / 1024).toFixed(2)} MB)...`);
      const downloadRes = await fetch(ipaArtifact.archive_download_url, { headers });
      const zipBuffer = Buffer.from(await downloadRes.arrayBuffer());
      const tmpZip = path.resolve('temp_ios.zip');
      fs.writeFileSync(tmpZip, zipBuffer);

      execSync(`tar -xf "${tmpZip}" -C "${path.resolve('.')}"`);
      fs.unlinkSync(tmpZip);

      const extractedIpa = path.resolve('FamilySoul伴侣_iOS.ipa');
      const desktopIpa = path.join(os.homedir(), 'Desktop', '【最新】FamilySoul_iOS.ipa');

      if (fs.existsSync(extractedIpa)) {
        fs.copyFileSync(extractedIpa, desktopIpa);
        fs.unlinkSync(extractedIpa);
        console.log(`🎉 [iOS Auto] 成功下载并覆盖桌面最新 IPA: ${desktopIpa}`);
      }
      break;
    }

    await new Promise(r => setTimeout(r, 25000));
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

