import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

async function main() {
  const tokenFile = path.join(os.homedir(), '.dsh/surfcore/github_token');
  const token = fs.readFileSync(tokenFile, 'utf8').trim();

  const apkBuildPath = path.resolve('mobile/build/app/outputs/flutter-apk/app-release.apk');
  const rootApkPath = path.resolve('mobile/FamilySoul_最新版.apk');

  const apkPath = fs.existsSync(apkBuildPath) ? apkBuildPath : rootApkPath;
  if (!fs.existsSync(apkPath)) {
    throw new Error('未找到 APK 文件: ' + apkPath);
  }

  // 复制一份到 mobile 根目录作为最新版 APK
  fs.copyFileSync(apkPath, rootApkPath);
  const apkSize = fs.statSync(apkPath).size;
  console.log(`[Release] 准备上传 APK: ${apkPath} (${(apkSize / 1024 / 1024).toFixed(2)} MB)`);

  let ipaPath = path.join(os.homedir(), 'Desktop', 'FamilySoul伴侣_最新版.ipa');
  const hasIpa = fs.existsSync(ipaPath);
  if (hasIpa) {
    console.log(`[Release] 发现 iOS IPA: ${ipaPath} (${(fs.statSync(ipaPath).size / 1024 / 1024).toFixed(2)} MB)`);
  }

  const tagName = process.argv[2] || 'v1.0.1';
  const releaseName = `FamilySoul ${tagName} · 视讯全角色3D虚拟人 & 安卓对讲直传彻底修复`;
  const releaseBody = `## 🌟 FamilySoul ${tagName} 重磅更新

### 📱 客户端下载
- **Android APK**：\`FamilySoul_${tagName}.apk\`
- **iOS 安装包**：\`FamilySoul_v1.0.0_iOS.ipa\`（若有最新版本自动同步）

### 🚀 本次更新核心日志
1. **安卓视频通话听声彻底修复**：针对摩托罗拉及国行安卓手机无 Google 语音框架问题，视讯界面底部新增专用大号【按住说话】高保真对讲按钮，长按录音、松开发送，中枢多模态极速转录并实时回答；
2. **三角色 3D 卡通立体形象全量上线**：
   - **相公端（小娘子）**：粉萌柔润面庞、发髻朱簪、娇羞腮红、水灵灵大眼、呼吸律动与灵动眨眼；
   - **夫人端（贴心大管家）**：英挺儒雅沉稳男管家、三七分短发、剑眉星眸、优雅领结；
   - **孩子端（全能导师）**：阳光智慧短发、知性黑框眼镜、明朗灿烂笑颜；
3. **视讯通话文案与称谓全角色自适应**：
   - 标题：闺房视讯对聊 / 贴心视讯对聊 / 探索视讯连线；
   - 视角与按钮：相公视角 / 夫人视角 / 小同学视角，让娘子端详我 / 让管家端详我 / 让导师看看我；
   - 主动问候语与神态点评完全遵循三成员各自的人设与口吻；
4. **服务端视讯接口原生升级**：软路由中枢 \`/video-chat\` 原生支持麦克风音频直传切片与摄像头截帧融合识别，彻底摆脱系统本地引擎依赖。
`;

  // 1. 创建 Release
  console.log(`[Release] 正在创建 GitHub Release: ${tagName}...`);
  const createRes = await fetch('https://api.github.com/repos/wxfyes/FamilySoul/releases', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'FamilySoul-Release-Agent',
    },
    body: JSON.stringify({
      tag_name: tagName,
      target_commitish: 'main',
      name: releaseName,
      body: releaseBody,
      draft: false,
      prerelease: false,
    }),
  });

  const releaseData = await createRes.json();
  if (!createRes.ok) {
    if (releaseData.errors?.[0]?.code === 'already_exists') {
      console.log(`[Release] Tag ${tagName} 已经存在，获取已有 Release...`);
      const getRes = await fetch(`https://api.github.com/repos/wxfyes/FamilySoul/releases/tags/${tagName}`, {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'FamilySoul-Release-Agent' },
      });
      const existing = await getRes.json();
      return await uploadAssets(existing.id, token, apkPath, hasIpa ? ipaPath : null, existing.html_url, tagName);
    }
    throw new Error(`创建 Release 失败: ${createRes.status} ${JSON.stringify(releaseData)}`);
  }

  console.log(`[Release] 创建成功 (ID: ${releaseData.id}) URL: ${releaseData.html_url}`);
  await uploadAssets(releaseData.id, token, apkPath, hasIpa ? ipaPath : null, releaseData.html_url, tagName);
}

async function uploadAssets(releaseId, token, apkPath, ipaPath, releaseUrl, tagName) {
  // 1. 上传 APK
  const apkName = `FamilySoul_${tagName}.apk`;
  console.log(`[Release] 正在上传 APK 资产: ${apkName}...`);
  const apkBytes = fs.readFileSync(apkPath);
  const apkRes = await fetch(`https://uploads.github.com/repos/wxfyes/FamilySoul/releases/${releaseId}/assets?name=${apkName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': String(apkBytes.length),
      'User-Agent': 'FamilySoul-Release-Agent',
    },
    body: apkBytes,
  });

  if (!apkRes.ok) {
    console.error(`[Release] APK 上传响应异常: ${apkRes.status}`, await apkRes.text());
  } else {
    const apkData = await apkRes.json();
    console.log(`✅ [Release] APK 上传成功: ${apkData.browser_download_url}`);
  }

  // 2. 上传 IPA (如果有)
  if (ipaPath && fs.existsSync(ipaPath)) {
    const ipaName = `FamilySoul_${tagName}_iOS.ipa`;
    console.log(`[Release] 正在上传 iOS IPA 资产: ${ipaName}...`);
    const ipaBytes = fs.readFileSync(ipaPath);
    const ipaRes = await fetch(`https://uploads.github.com/repos/wxfyes/FamilySoul/releases/${releaseId}/assets?name=${ipaName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(ipaBytes.length),
        'User-Agent': 'FamilySoul-Release-Agent',
      },
      body: ipaBytes,
    });

    if (!ipaRes.ok) {
      console.error(`[Release] IPA 上传响应异常: ${ipaRes.status}`, await ipaRes.text());
    } else {
      const ipaData = await ipaRes.json();
      console.log(`✅ [Release] IPA 上传成功: ${ipaData.browser_download_url}`);
    }
  }

  console.log('\n======================================================');
  console.log(`🎉 全部安装包已成功上架 GitHub Releases！`);
  console.log(`🔗 访问页面: ${releaseUrl}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('上传失败:', err);
  process.exit(1);
});
