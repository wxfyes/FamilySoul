import io

p = '.github/workflows/build-mobile-ios.yml'
s = io.open(p, encoding='utf-8').read()

old_head = """name: Build iOS IPA

on:
  push:
    paths:
      - 'mobile/**'
      - '.github/workflows/build-mobile-ios.yml'
  workflow_dispatch: # 支持在 GitHub 网页上一键手动点击触发构建
"""

new_head = """name: Build iOS IPA

# 只在"客户端代码真的变了"时才打包：lib 里的 Dart、依赖清单、iOS/Android 原生壳
# 改服务端、文档、脚本、看板 —— 一律不触发，省 macOS 机时
on:
  push:
    paths:
      - 'mobile/lib/**'                 # Dart 源码（改了必须重打）
      - 'mobile/pubspec.yaml'           # 依赖变了
      - 'mobile/pubspec.lock'
      - 'mobile/assets/**'              # 资源（图标、语音权重等）
      - 'mobile/ios/**'                 # iOS 原生壳
      - 'mobile/android/app/**'         # 安卓原生壳（改配置也一并出新包）
      - '.github/workflows/build-mobile-ios.yml'
  workflow_dispatch: # 也可以在网页上手动点一下

# 连续推送时只跑最新一次，前面没跑完的直接取消，不浪费机时
concurrency:
  group: ios-build-${{ github.ref }}
  cancel-in-progress: true
"""

if old_head in s:
    s = s.replace(old_head, new_head, 1)
    io.open(p, 'w', encoding='utf-8').write(s)
    print('已改触发范围 + 并发取消')
else:
    print('WARN: 头部没匹配上')
