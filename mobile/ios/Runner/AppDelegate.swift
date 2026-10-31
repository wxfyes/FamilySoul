import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate {
  private var keepAwakeTimer: Timer?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)

    // 强制开启屏幕常亮 & 关闭距离传感器黑屏（防止视讯对聊免提说话时自动息屏或贴近黑屏）
    application.isIdleTimerDisabled = true
    UIDevice.current.isProximityMonitoringEnabled = false

    // 定时器持续守护，防止 audioplayers / camera / speech_to_text 结束后重置常亮状态
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

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
    application.isIdleTimerDisabled = true
    UIDevice.current.isProximityMonitoringEnabled = false
  }
}
