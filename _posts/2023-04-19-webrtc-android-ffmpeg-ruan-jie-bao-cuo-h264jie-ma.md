---
id: 151
title: 'WebRTC Android FFmpeg软解报错 H264解码找不到'
date: '2023-04-19T11:20:07+08:00'
author: zhaoyou
layout: post
guid: 'https://fifo.site/?p=151'
permalink: /webrtc-android-ffmpeg-ruan-jie-bao-cuo-h264jie-ma.html
views:
    - '11'
categories:
    - RTC
tags:
    - Android
    - FFMpeg
    - h264
    - WebRTC
image:
  path: http://io.fifo.site/thumb-1.jpg
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

###  报错：

```c++
  const AVCodec* codec = avcodec_find_decoder(av_context_->codec_id);
  if (!codec) {
    // This is an indication that FFmpeg has not been initialized or it has not
    // been compiled/initialized with the correct set of codecs.
    RTC_LOG(LS_ERROR) << "FFmpeg H.264 decoder not found.";
    Release();
    ReportError();
    return false;
  }

```

增加编译参数` rtc\_use\_h264=true` 不管用！

###  修改 ffmpeg\_generated.gni

找到`third_party/ffmpeg/ffmpeg_generated.gni`
`use\_linux\_config`，添加 `|| is\_android`以支持，结果如下

```
use_linux_config = is_linux || is_fuchsia || is_android
```

###  增加 codec\_list parser\_list h264 支持

修改 `arm64`, 相应的armv7的改相应目录即可

```c++
chromium/config/Chrome/android/arm64/config.h 中 CONFIG_H264_DECODER 设置为 1
third_party/ffmpeg/chromium/config/Chrome/android/arm64/libavcodec/parser_list.c 添加 &ff_h264_parser,
third_party/ffmpeg/chromium/config/Chrome/android/arm64/libavcodec/codec_list.c 添加 &ff_h264_decoder
```

编译参数添加 `rtc_use_h264=true ffmpeg_branding="Chrome"`

参考：<https://blog.csdn.net/CSqingchen/article/details/120199702>