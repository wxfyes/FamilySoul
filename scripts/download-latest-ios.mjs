import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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

  console.log('[iOS Fetcher] 正在拉取最新的 iOS IPA 构建流...');
  const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/build-mobile-ios.yml/runs?per_page=1`, { headers });
  if (!runsRes.ok) {
    throw new Error(`获取 workflow runs 失败: ${runsRes.status} ${await runsRes.text()}`);
  }
  const runsData = await runsRes.json();
  const latestRun = runsData.workflow_runs?.[0];
  if (!latestRun) {
    console.log('[iOS Fetcher] 未找到任何 iOS workflow run');
    return;
  }

  console.log(`[iOS Fetcher] 最新 Run ID: ${latestRun.id}, 状态: ${latestRun.status}, 结论: ${latestRun.conclusion}`);

  if (latestRun.status !== 'completed') {
    console.log(`[iOS Fetcher] 云端构建正在进行中 (status: ${latestRun.status})...`);
    return { status: latestRun.status };
  }

  if (latestRun.conclusion !== 'success') {
    throw new Error(`[iOS Fetcher] 最新构建未成功完成: ${latestRun.conclusion}`);
  }

  // 获取产物
  const artifactsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${latestRun.id}/artifacts`, { headers });
  const artifactsData = await artifactsRes.json();
  const ipaArtifact = artifactsData.artifacts?.find(a => a.name.includes('iOS'));

  if (!ipaArtifact) {
    console.log('[iOS Fetcher] 未找到 iOS 安装包产物');
    return;
  }

  console.log(`[iOS Fetcher] 发现产物: ${ipaArtifact.name} (${(ipaArtifact.size_in_bytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`[iOS Fetcher] 正在下载 zip 压缩包...`);

  const downloadRes = await fetch(ipaArtifact.archive_download_url, { headers });
  if (!downloadRes.ok) {
    throw new Error(`下载产物失败: ${downloadRes.status}`);
  }

  const zipBuffer = Buffer.from(await downloadRes.arrayBuffer());
  const tmpZip = path.resolve('temp_ios.zip');
  fs.writeFileSync(tmpZip, zipBuffer);

  // 解压 zip 提取 .ipa
  const { execSync } = await import('node:child_process');
  execSync(`tar -xf "${tmpZip}" -C "${path.resolve('.')}"`);
  fs.unlinkSync(tmpZip);

  // 移动并覆盖桌面最新文件
  const extractedIpa = path.resolve('FamilySoul伴侣_iOS.ipa');
  const desktopIpa = path.join(os.homedir(), 'Desktop', '【最新】FamilySoul_iOS.ipa');

  if (fs.existsSync(extractedIpa)) {
    fs.copyFileSync(extractedIpa, desktopIpa);
    fs.unlinkSync(extractedIpa);
    console.log(`✅ [iOS Fetcher] 已成功覆盖桌面文件: ${desktopIpa}`);
  } else {
    console.warn('[iOS Fetcher] 未在 zip 根目录找到 FamilySoul伴侣_iOS.ipa');
  }
}

main().catch(err => {
  console.error('[iOS Fetcher 异常]', err);
  process.exit(1);
});

