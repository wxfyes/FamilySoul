import Flutter
import UIKit
import Vision

@main
@objc class AppDelegate: FlutterAppDelegate {
  private var keepAwakeTimer: Timer?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // 1. 强制开启屏幕常亮 & 关闭距离传感器黑屏
    application.isIdleTimerDisabled = true
    UIDevice.current.isProximityMonitoringEnabled = false

    keepAwakeTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
      if UIApplication.shared.applicationState == .active {
        if !UIApplication.shared.isIdleTimerDisabled {
          UIApplication.shared.isIdleTimerDisabled = true
        }
        if UIDevice.current.isProximityMonitoringEnabled {
          UIDevice.current.isProximityMonitoringEnabled = false
        }
      }
    }

    // 2. 注册苹果原生离线视觉识别通道 (Apple Vision Framework: 100% 离线免代理识图 + 实况文本 OCR + 人脸场景感知)
    if let controller = window?.rootViewController as? FlutterViewController {
      let visionChannel = FlutterMethodChannel(
        name: "familysoul/local_vision",
        binaryMessenger: controller.binaryMessenger
      )
      visionChannel.setMethodCallHandler { [weak self] (call, result) in
        guard call.method == "analyzeImage" else {
          result(FlutterMethodNotImplemented)
          return
        }
        guard let args = call.arguments as? [String: Any] else {
          result("")
          return
        }
        let filePath = args["path"] as? String
        let base64Str = args["base64"] as? String
        self?.analyzeImageOffline(filePath: filePath, base64Str: base64Str, completion: result)
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    application.isIdleTimerDisabled = true
    UIDevice.current.isProximityMonitoringEnabled = false
  }

  private func analyzeImageOffline(
    filePath: String?,
    base64Str: String?,
    completion: @escaping FlutterResult
  ) {
    DispatchQueue.global(qos: .userInitiated).async {
      var cgImage: CGImage?
      var imgSize: CGSize = .zero

      if let path = filePath, !path.isEmpty, let uiImg = UIImage(contentsOfFile: path) {
        cgImage = uiImg.cgImage
        imgSize = uiImg.size
      } else if let b64 = base64Str, !b64.isEmpty {
        let clean = b64.components(separatedBy: ",").last ?? b64
        if let data = Data(base64Encoded: clean, options: .ignoreUnknownCharacters),
           let uiImg = UIImage(data: data) {
          cgImage = uiImg.cgImage
          imgSize = uiImg.size
        }
      }

      guard let targetCGImage = cgImage else {
        DispatchQueue.main.async { completion("") }
        return
      }

      var recognizedTexts: [String] = []
      var sceneLabels: [String] = []
      var faceCount = 0

      let handler = VNImageRequestHandler(cgImage: targetCGImage, options: [:])

      // A. 实况文本 OCR (中英混排高精度离线文字识别，过滤低于2字符的噪点纹理)
      let textReq = VNRecognizeTextRequest { req, _ in
        guard let obs = req.results as? [VNRecognizedTextObservation] else { return }
        for o in obs.prefix(35) {
          if let top = o.topCandidates(1).first, top.confidence > 0.45 {
            let line = top.string.trimmingCharacters(in: .whitespacesAndNewlines)
            if line.count >= 2 {
              recognizedTexts.append(line)
            }
          }
        }
      }
      textReq.recognitionLevel = .accurate
      textReq.usesLanguageCorrection = true
      textReq.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]
      try? handler.perform([textReq])

      // B. 人脸与神态检测（独立执行，防止与分类请求互相中断）
      let faceReq = VNDetectFaceLandmarksRequest { req, _ in
        if let faces = req.results as? [VNFaceObservation] {
          faceCount = faces.count
        }
      }
      try? handler.perform([faceReq])

      // C. 场景与物体分类 (1300+ 类离线物体场景标签，独立执行并降低多物体场景阈值至 0.04)
      if #available(iOS 13.0, *) {
        let classifyReq = VNClassifyImageRequest { req, _ in
          guard let obs = req.results as? [VNClassificationObservation] else { return }
          let sorted = obs.sorted { $0.confidence > $1.confidence }
          for item in sorted where item.confidence > 0.04 {
            let zh = Self.translateVisionLabel(item.identifier)
            if !zh.isEmpty && !sceneLabels.contains(zh) {
              sceneLabels.append(zh)
            }
            if sceneLabels.count >= 10 { break }
          }
        }
        try? handler.perform([classifyReq])
      }

      var summaryParts: [String] = []
      if imgSize.width > 0 && imgSize.height > 0 {
        let ratioDesc = imgSize.height > imgSize.width * 1.4 ? "手机竖屏画面/截图" : (imgSize.width > imgSize.height * 1.2 ? "横屏画面/截图" : "照片画面")
        summaryParts.append("画面类型：\(ratioDesc)（分辨率 \(Int(imgSize.width))x\(Int(imgSize.height))）")
      }
      if faceCount > 0 {
        summaryParts.append("人物检测：画面中有 \(faceCount) 位人物面孔")
      }
      if !sceneLabels.isEmpty {
        summaryParts.append("场景与物体特征：\(sceneLabels.joined(separator: "、"))")
      }
      if !recognizedTexts.isEmpty {
        let joinedText = recognizedTexts.joined(separator: " | ")
        let clipped = String(joinedText.prefix(500))
        summaryParts.append("图中清晰识别到的文字内容：「\(clipped)」")
      }

      let finalSummary = summaryParts.joined(separator: "；")
      DispatchQueue.main.async {
        completion(finalSummary)
      }
    }
  }

  private static func translateVisionLabel(_ id: String) -> String {
    let map: [String: String] = [
      "teapot": "茶壶/泡茶器",
      "kettle": "水壶/茶壶",
      "pitcher": "玻璃茶壶/水壶",
      "carafe": "玻璃壶",
      "jug": "水壶/茶具",
      "beaker": "透明玻璃器皿",
      "glass": "玻璃杯/玻璃器皿",
      "mug": "马克杯/水杯",
      "coffee_cup": "咖啡杯/马克杯",
      "teacup": "茶杯",
      "cup": "杯子",
      "tableware": "茶具/桌面器皿",
      "drinkware": "杯具/茶具",
      "bottle": "瓶子",
      "lighter": "打火机",
      "remote": "遥控器",
      "person": "人物",
      "people": "人物",
      "adult": "成年人",
      "man": "男士",
      "woman": "女士",
      "child": "儿童",
      "portrait": "人像特写",
      "selfie": "自拍人像",
      "face": "面部特写",
      "smile": "微笑神态",
      "eyeglasses": "佩戴眼镜",
      "sunglasses": "墨镜",
      "clothing": "服饰穿搭",
      "shirt": "上衣/衬衫",
      "coat": "外套",
      "indoor": "室内环境",
      "room": "房间内",
      "bedroom": "卧室",
      "living_room": "客厅",
      "office": "办公桌面环境",
      "desk": "书桌/办公桌",
      "table": "桌面/台面",
      "countertop": "台面",
      "wood": "木质台面",
      "furniture": "家具/桌椅",
      "computer": "电脑设备",
      "laptop": "笔记本电脑",
      "keyboard": "电脑键盘",
      "mouse": "鼠标",
      "display": "电脑显示器/屏幕",
      "monitor": "电脑显示器",
      "television": "显示屏/电视",
      "screen": "电子屏幕",
      "electronics": "电子数码设备",
      "mobile_phone": "智能手机",
      "cellphone": "手机",
      "screenshot": "手机屏幕截图",
      "text": "文字界面",
      "document": "文档资料",
      "paper": "纸张文件",
      "book": "书籍",
      "food": "美食佳肴",
      "dish": "菜品",
      "tea": "茶水/茶饮",
      "beverage": "茶饮/饮品",
      "drink": "饮品",
      "chair": "座椅",
      "cat": "猫咪",
      "dog": "狗狗",
      "pet": "宠物",
      "car": "汽车",
      "vehicle": "交通工具",
      "outdoor": "户外场景",
      "sky": "天空",
      "night": "夜晚灯光",
      "plant": "绿植花卉",
      "flower": "鲜花",
      "tree": "树木",
      "building": "建筑物",
      "street": "街道"
    ]
    let lower = id.lowercased()
    if let exact = map[lower] { return exact }
    for (k, v) in map {
      if lower.contains(k) { return v }
    }
    return id.replacingOccurrences(of: "_", with: " ")
  }
}
