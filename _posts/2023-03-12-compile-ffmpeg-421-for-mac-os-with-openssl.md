---
id: 125
title: 'Compile ffmpeg 4.2.1 for mac os with openssl'
date: '2023-03-12T21:38:58+08:00'
author: zhaoyou
layout: post
guid: 'https://fifo.site/?p=125'
permalink: /compile-ffmpeg-421-for-mac-os-with-openssl.html
views:
    - '41'
categories:
    - 拙记
image:
  path: http://io.fifo.site/thumb-10.jpg
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

编译环境：`mac os x 10.15.3` ， `ffmpeg 4.2.1`

```bash
./configure --target-os=darwin \
            --disable-programs  \
            --libdir=./ffmpegbuild/lib \
            --incdir=./ffmpegbuild/include  \
            --extra-cflags=-mmacosx-version-min=10.8 \
            --extra-ldflags=-mmacosx-version-min=10.8  \
            --enable-pic \
            --enable-dct \
            --enable-dwt \
            --enable-lsp \
            --enable-mdct \
            --enable-rdft \
            --enable-fft \
            --enable-runtime-cpudetect \
            --disable-ffmpeg \
            --disable-ffplay \
            --disable-ffprobe \
            --disable-doc \
            --disable-symver \
            --disable-protocols \
            --enable-small \
            --enable-gpl --enable-nonfree --enable-version3 --disable-iconv \
            --disable-decoders --enable-decoder=vp9 --enable-decoder=h264 --enable-decoder=mpeg4 --enable-decoder=aac --enable-decoder=mp3 --enable-decoder=flac --enable-decoder=pcm_s16le \
            --disable-encoders \
            --disable-demuxers --enable-demuxer=rtsp --enable-demuxer=rtp --enable-demuxer=flv --enable-demuxer=h264 --enable-demuxer=wav --enable-demuxer=aac \
            --enable-demuxer=hls --enable-demuxer=mp3 --enable-muxer=ogg --enable-demuxer=flac \
            --enable-demuxer=amr --enable-decoder=amrwb --enable-decoder=amrnb --enable-demuxer=wav --enable-decoder=wavpack --enable-demuxer=avi \
            --disable-muxers --enable-muxer=rtsp --enable-muxer=rtp --enable-muxer=flv --enable-muxer=h264 --enable-muxer=mp4 --enable-muxer=wav --enable-muxer=adts \
            --disable-parsers --enable-parser=mpeg4video --enable-parser=aac --enable-parser=h264 --enable-parser=vp9 \
            --enable-decoder=jpeg2000 \
            --enable-decoder=jpegls \
            --enable-decoder=mjpeg \
            --enable-decoder=mjpegb \
            --enable-muxer=mjpeg \
            --enable-demuxer=mjpeg \
            --enable-encoder=png \
            --enable-decoder=png \
            --enable-parser=png \
            --enable-protocol=http --enable-protocol=https \
            --enable-protocol=rtmp --enable-protocol=rtp --enable-protocol=tcp --enable-protocol=udp --enable-protocol=file \
            --disable-bsfs \
            --disable-indevs --enable-indev=v4l2 \
            --disable-outdevs \
            --disable-postproc \
            --enable-openssl --enable-protocol=crypto --enable-protocol=tls_openssl \
            --extra-cflags=-I/Users/gezhaoyou/repos/libs/ffmpeg/mac/openssl/include \
            --extra-ldflags=-L/Users/gezhaoyou/repos/libs/ffmpeg/mac/openssl/lib \

```

openssl 需要提前编译好，可以参考 [Compile Openssl for mac](https://www.jianshu.com/p/a7425f207e4c)

`--extra-cflags` 和 `--extra-ldflags` 指定了opensll 头文件路径和库文件路径

```bash
ffmpeg` 编译输出路径为：`--libdir=./ffmpegbuild/lib

```

上面的ffmpeg配置选项支持常见封装的解码播放，如`mp3`， `mp4`, `hls`，支持 `https`, 若要支持编码，需自行添加相关参数和库依赖