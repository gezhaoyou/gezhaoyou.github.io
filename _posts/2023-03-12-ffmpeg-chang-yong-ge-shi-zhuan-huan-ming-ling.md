---
id: 129
title: FFmpeg常用格式转换命令
date: '2023-03-12T21:41:56+08:00'
author: zhaoyou
layout: post
guid: 'https://fifo.site/?p=129'
permalink: /ffmpeg-chang-yong-ge-shi-zhuan-huan-ming-ling.html
views:
    - '105'
categories:
    - 拙记
tags:
    - FFMpeg
image:
  path: http://io.fifo.site/thumb-9.jpg
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

做音视频开发可能会用到一些 `wav`, `pcm`, `mp4`, `yuv` 等测试文件，整理了一下常用FFmpeg命令，可以从mp4中分离音频未wav, wav可以转成不同采样率的 `pcm`.

- mp4 提取音频为wav

```console
ffmpeg -i input.mp4 -acodec pcm_s16le -f s16le -ac 1 -ar 16000 -f wav output.wav

```

- mp4 转yuv420

```console
ffmpeg -i input.mp4 -s 720x1280 -pix_fmt yuv420p output.yuv

```

- wav 转 pcm 16k 16bit

```console
ffmpeg -i input.wav -ar 16000 -ac 1 -f s16le output.pcm

```