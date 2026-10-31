import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export class EdgeTtsService {
  constructor({ voiceDir, defaultVoice = 'zh-CN-XiaoxiaoNeural', rate = '+0%', pitch = '+0Hz' } = {}) {
    this.voiceDir = voiceDir || path.resolve(process.cwd(), 'data/voice');
    this.defaultVoice = defaultVoice;
    this.rate = rate;
    this.pitch = pitch;
    fs.mkdirSync(this.voiceDir, { recursive: true });
    this.detectedBinary = this._detectBinary();
  }

  _detectBinary() {
    const candidates = [
      path.resolve(process.cwd(), 'edge-tts/edge-tts.exe'),
      '/usr/bin/edge-tts',
      '/usr/local/bin/edge-tts',
      '/opt/familysoul/edge-tts/edge-tts',
      '/opt/surfcore-server/edge-tts/edge-tts',
      path.resolve(process.cwd(), '../edge-tts/edge-tts.exe'),
      path.resolve(process.cwd(), '../tools/dist/edge-tts/edge-tts.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return { type: 'file', cmd: p };
    }
    return { type: 'global', cmd: 'edge-tts' };
  }

  getAudioFile(key) {
    const safeKey = String(key || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeKey) return null;
    const candidates = [
      path.join(this.voiceDir, `${safeKey}.wav`),
      path.join(this.voiceDir, `${safeKey}.mp3`),
    ];
    for (const f of candidates) {
      if (fs.existsSync(f)) return f;
    }
    return null;
  }

  async synthesizeToFile({ text, voice = this.defaultVoice, rate = this.rate, pitch = this.pitch }) {
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('合成文本为空');

    const cacheKey = crypto.createHash('md5').update(`${voice}_${rate}_${pitch}_${cleanText}`).digest('hex');
    const outFile = path.join(this.voiceDir, `${cacheKey}.wav`);

    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 100) {
      console.log(`[TTS] 命中语音缓存: ${cacheKey}.wav`);
      return { ok: true, key: cacheKey, path: outFile, cached: true };
    }

    console.log(`[TTS] 正在合成「${voice}」语音 (${cleanText.length}字): ${cleanText.slice(0, 30)}...`);
    const bin = this.detectedBinary;
    const rateArg = rate || '+0%';
    const pitchArg = pitch || '+0Hz';

    if (bin.type === 'file') {
      try {
        await execFileAsync(bin.cmd, [
          '--voice', voice,
          '--rate', rateArg,
          '--pitch', pitchArg,
          '--text', cleanText,
          '--write-media', outFile,
        ]);
      } catch (fileErr) {
        // 如果二进制调用失败，降级尝试 python3 模块
        console.warn(`[TTS] 二进制 ${bin.cmd} 执行失败，尝试 python3 -m edge_tts 兜底...`);
        const escapedText = cleanText.replace(/"/g, '\\"');
        const pyCmd = `python3 -m edge_tts --voice "${voice}" --rate "${rateArg}" --pitch "${pitchArg}" --text "${escapedText}" --write-media "${outFile}"`;
        await execAsync(pyCmd);
      }
    } else {
      // 在 Linux / Docker 中直接调用系统级 edge-tts
      const escapedText = cleanText.replace(/"/g, '\\"');
      const cmdStr = `edge-tts --voice "${voice}" --rate "${rateArg}" --pitch "${pitchArg}" --text "${escapedText}" --write-media "${outFile}"`;
      try {
        await execAsync(cmdStr);
      } catch (err) {
        console.warn(`[TTS] 全局 edge-tts 执行失败，尝试 python3 -m edge_tts 兜底...`);
        const pyCmd = `python3 -m edge_tts --voice "${voice}" --rate "${rateArg}" --pitch "${pitchArg}" --text "${escapedText}" --write-media "${outFile}"`;
        await execAsync(pyCmd);
      }
    }

    if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 100) {
      throw new Error('Edge-TTS 合成完毕但未生成有效的音频文件');
    }

    const stat = fs.statSync(outFile);
    console.log(`[TTS] ✅ 合成成功: ${cacheKey}.wav (${stat.size} 字节)`);
    return { ok: true, key: cacheKey, path: outFile, cached: false };
  }
}
