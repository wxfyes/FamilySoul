package com.surfcore.surfcore_mobile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.media.FaceDetector
import android.os.Bundle
import android.util.Base64
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream
import kotlin.concurrent.thread

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } catch (_: Exception) {}
    }

    override fun onResume() {
        super.onResume()
        try {
            window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } catch (_: Exception) {}
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "familysoul/local_vision")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "analyzeImage" -> {
                        val path = call.argument<String>("path") ?: ""
                        val base64Str = call.argument<String>("base64") ?: ""
                        thread {
                            val summary = analyzeBitmapOffline(path, base64Str)
                            runOnUiThread { result.success(summary) }
                        }
                    }
                    "extractAsrAssets" -> {
                        val targetDirPath = call.argument<String>("targetDir") ?: ""
                        val files = call.argument<List<String>>("files") ?: emptyList()
                        thread {
                            val ok = extractAsrAssetsStreaming(targetDirPath, files)
                            runOnUiThread { result.success(ok) }
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    /**
     * 使用 64KB 流式缓冲区在后台线程解压大体积 ONNX 语音模型，
     * 避免 Flutter rootBundle.load 一次性在内存分配 154MB 导致 Android OOM 闪退
     */
    private fun extractAsrAssetsStreaming(targetDirPath: String, files: List<String>): Boolean {
        return try {
            if (targetDirPath.isEmpty()) return false
            val dir = File(targetDirPath)
            if (!dir.exists()) dir.mkdirs()

            for (fileName in files) {
                val outFile = File(dir, fileName)
                if (outFile.exists() && outFile.length() > 1024) {
                    continue
                }
                val assetKey = "flutter_assets/assets/asr/$fileName"
                val tmpFile = File(dir, "$fileName.tmp")
                assets.open(assetKey).use { input ->
                    FileOutputStream(tmpFile).use { output ->
                        val buffer = ByteArray(65536)
                        var read: Int
                        while (input.read(buffer).also { read = it } != -1) {
                            output.write(buffer, 0, read)
                        }
                        output.flush()
                    }
                }
                if (outFile.exists()) outFile.delete()
                tmpFile.renameTo(outFile)
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    private fun analyzeBitmapOffline(path: String, base64Str: String): String {
        return try {
            val opts = BitmapFactory.Options().apply {
                inPreferredConfig = Bitmap.Config.RGB_565
                inSampleSize = 2
            }
            var bmp: Bitmap? = null
            if (path.isNotEmpty() && File(path).exists()) {
                bmp = BitmapFactory.decodeFile(path, opts)
            } else if (base64Str.isNotEmpty()) {
                val clean = base64Str.substringAfterLast(",")
                val bytes = Base64.decode(clean, Base64.DEFAULT)
                bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
            }
            if (bmp == null) return ""

            // 确保宽度为偶数以供 FaceDetector 使用
            val evenWidth = if (bmp.width % 2 == 0) bmp.width else bmp.width - 1
            val targetBmp = if (evenWidth != bmp.width && evenWidth > 0) {
                Bitmap.createBitmap(bmp, 0, 0, evenWidth, bmp.height)
            } else {
                bmp
            }

            val detector = FaceDetector(targetBmp.width, targetBmp.height, 5)
            val faces = arrayOfNulls<FaceDetector.Face>(5)
            val faceCount = detector.findFaces(targetBmp, faces)

            // 采样图像亮度与色调
            var rSum = 0L
            var gSum = 0L
            var bSum = 0L
            var samples = 0
            val stepX = (targetBmp.width / 16).coerceAtLeast(1)
            val stepY = (targetBmp.height / 16).coerceAtLeast(1)
            for (x in 0 until targetBmp.width step stepX) {
                for (y in 0 until targetBmp.height step stepY) {
                    val pixel = targetBmp.getPixel(x, y)
                    rSum += Color.red(pixel)
                    gSum += Color.green(pixel)
                    bSum += Color.blue(pixel)
                    samples++
                }
            }

            val avgR = if (samples > 0) (rSum / samples).toInt() else 128
            val avgG = if (samples > 0) (gSum / samples).toInt() else 128
            val avgB = if (samples > 0) (bSum / samples).toInt() else 128
            val brightness = (avgR * 299 + avgG * 587 + avgB * 114) / 1000

            val lightDesc = when {
                brightness < 55 -> "光线偏暗/夜间温馨氛围"
                brightness > 195 -> "光线明亮清晰/浅色背景"
                else -> "室内自然柔和光线"
            }

            val toneDesc = when {
                avgR > avgB + 25 -> "暖色调画面"
                avgB > avgR + 25 -> "冷色调/电子屏幕画面"
                else -> "色彩均衡自然"
            }

            val parts = mutableListOf<String>()
            if (faceCount > 0) {
                parts.add("画面中检测到 $faceCount 位人物面孔（神态自然清晰）")
            }
            parts.add("光线与色调：$lightDesc，$toneDesc")
            parts.joinToString("；")
        } catch (e: Exception) {
            ""
        }
    }
}
