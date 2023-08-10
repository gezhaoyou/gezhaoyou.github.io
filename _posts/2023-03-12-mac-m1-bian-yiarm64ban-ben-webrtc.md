---
id: 123
title: 'Mac M1 编译arm64版本 WebRTC'
date: '2023-03-12T21:37:40+08:00'
author: zhaoyou
layout: post
guid: 'https://fifo.site/?p=123'
permalink: /mac-m1-bian-yiarm64ban-ben-webrtc.html
views:
    - '55'
categories:
    - RTC
tags:
    - RTC
image:
  path: http://io.fifo.site/thumb-7.jpg
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

##  Mac M1 编译arm64版本 WebRTC

```shell
gn gen out/mac --args='target_os="mac" is_debug=false target_cpu="arm64" rtc_include_tests=false enable_dsyms=true is_debug=true' --ide=xcode

```

- 架构选 `target_cpu="arm64"`
- `enable_dsyms=true` 可以使 WebRTC Xcode工程添加断点调试
- `is_debug=true` 生成debug版本工程，断点可查看变量详情
- `rtc_include_tests=false ` 关闭测试，否成工程工出现大量单元测试文件

##  iOS版本WebRTC Framework编译

若直接编译iOS Apprtc 可以编译成功，但安装时候会报 `webrtc  No code signature found`

```shell
gn gen out/ios-framework --args='target_os="ios" is_debug=false target_cpu="arm64" rtc_include_tests=false ios_enable_code_signing=false' --ide=xcode

```

最终我没解决，可以使用另外一种方式，新建一个xcode工程，将rtc demo的代码导入到新创建的工程中，然后链接WebRTC.framework

WebRTC Framework编译

```shell
gn gen out/ios-framework --args='target_os="ios" is_debug=false target_cpu="arm64" rtc_include_tests=false ios_enable_code_signing=false rtc_enable_symbol_export=true' --ide=xcode

ninja -C out/ios-framework framework_objc

```

抽出来的demo在这 <https://github.com/gezhaoyou/apprtc-demo> ，可以直接跑，也可以自己编译WebRTC.framework替换