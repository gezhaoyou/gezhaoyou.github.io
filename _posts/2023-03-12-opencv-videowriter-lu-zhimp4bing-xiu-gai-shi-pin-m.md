---
id: 126
title: 'OpenCV VideoWriter录制mp4并修改视频码率'
date: '2023-03-12T21:39:29+08:00'
author: zhaoyou
layout: post
guid: 'https://fifo.site/?p=126'
permalink: /opencv-videowriter-lu-zhimp4bing-xiu-gai-shi-pin-m.html
views:
    - '54'
categories:
    - 拙记
tags:
    - OpenCV
image:
  path: http://io.fifo.site/thumb-5.jpg
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

OpenCV版本 `opencv-4.5.3`

###  封装设置视频码率逻辑

修改opencv源码 `modules/videoio/include/opencv2/videoio.hpp`  
修改 197行, 添加 `VIDEOWRITER_PROP_BITRATE = 9,`

```c
enum VideoWriterProperties {
  VIDEOWRITER_PROP_QUALITY = 1,    //!< Current quality (0..100%) of the encoded videostream. Can be adjusted dynamically in some codecs.
  VIDEOWRITER_PROP_FRAMEBYTES = 2, //!< (Read-only): Size of just encoded video frame. Note that the encoding order may be different from representation order.
  VIDEOWRITER_PROP_NSTRIPES = 3,   //!< Number of stripes for parallel encoding. -1 for auto detection.
  VIDEOWRITER_PROP_IS_COLOR = 4,   //!< If it is not zero, the encoder will expect and encode color frames, otherwise it
                                   //!< will work with grayscale frames.
  VIDEOWRITER_PROP_DEPTH = 5,      //!< Defaults to CV_8U.
  VIDEOWRITER_PROP_HW_ACCELERATION = 6, //!< (**open-only**) Hardware acceleration type (see #VideoAccelerationType). Setting supported only via `params` parameter in VideoWriter constructor / .open() method. Default value is backend-specific.
  VIDEOWRITER_PROP_HW_DEVICE       = 7, //!< (**open-only**) Hardware device index (select GPU if multiple available). Device enumeration is acceleration type specific.
  VIDEOWRITER_PROP_HW_ACCELERATION_USE_OPENCL= 8, //!< (**open-only**) If non-zero, create new OpenCL context and bind it to current thread. The OpenCL context created with Video Acceleration context attached it (if not attached yet) for optimized GPU data copy between cv::UMat and HW accelerated encoder.
  VIDEOWRITER_PROP_BITRATE = 9,
#ifndef CV_DOXYGEN
  CV__VIDEOWRITER_PROP_LATEST
#endif
};

```

修改 `modules/videoio/src/cap_avfoundation.mm` 228行左右，获取码率参数:

```c
cv::Ptr<cv::IVideoWriter> cv::create_AVFoundation_writer(const std::string& filename, int fourcc,
                                                         double fps, const cv::Size &frameSize,
                                                         const cv::VideoWriterParameters& params)
{
    CvSize sz = { frameSize.width, frameSize.height };
    const bool isColor = params.get(VIDEOWRITER_PROP_IS_COLOR, true);
    const int bitrate = params.get(VIDEOWRITER_PROP_BITRATE, 600000);
    CvVideoWriter_AVFoundation* wrt = new CvVideoWriter_AVFoundation(filename.c_str(), fourcc, fps, sz, bitrate, isColor);
    return cv::makePtr<cv::LegacyWriter>(wrt);
}

```

修改1202行左右，修改 CvVideoWriter\_AVFoundation构造函数，添加 `int bitrate` 参数：

```c
CvVideoWriter_AVFoundation::CvVideoWriter_AVFoundation(const char* filename, int fourcc,
        double fps, CvSize frame_size,
        int bitrate, int is_color) {

```

修改 1306行左右，将码率设置给 `AVAssetWriterInput`

```objc
NSDictionary* videoCompressionSetting = [NSDictionary dictionaryWithObjectsAndKeys:
        [NSNumber numberWithInteger:bitrate], AVVideoAverageBitRateKey,
        nil]; // 设置 AVAssetWriterInput 编码码率

NSDictionary *videoSettings = [NSDictionary dictionaryWithObjectsAndKeys:
        codec, AVVideoCodecKey,
        [NSNumber numberWithInt:movieSize.width], AVVideoWidthKey,
        [NSNumber numberWithInt:movieSize.height], AVVideoHeightKey,
        videoCompressionSetting, AVVideoCompressionPropertiesKey,
        nil];

 mMovieWriterInput = [[AVAssetWriterInput
        assetWriterInputWithMediaType:AVMediaTypeVideo
        outputSettings:videoSettings] retain];

```

所有修改完成

###  编译iOS OpenCV

opencv源码根目录执行

```bash
python platforms/ios/build_framework.py ios --iphoneos_archs armv7,arm64 --iphonesimulator_archs i386,x86_64

```

###  使用

####  创建配置 cv::VideoWriter 并设置视频码率

```c++
cv::VideoWriter writer;
cv::Size size = cv::Size(480, 640);
  int myFourcc = cv::VideoWriter::fourcc('H', '2', '6', '4');
  double fps = 30;
  std::vector<int> vect;
  vect.push_back(cv::VIDEOWRITER_PROP_BITRATE);
  vect.push_back(450*1000); // 更改 video 码率
  // outputPath = @"document/video.mp4" 存储路径
  writer.open([outputPath UTF8String], cv::CAP_AVFOUNDATION, myFourcc, fps, size, vect);

```

之后可以愉快的录制mp4文件，并且可以控制生成文件码率

参考：

1. [AVAssetWriter视频数据编码](https://www.jianshu.com/p/1975afb3cf2f)
2. [AVAssetWriter 实现高分辨率录制视频，生成低体积的视频文件](https://links.jianshu.com/go?to=https%3A%2F%2Fblog.csdn.net%2Fsinat_31177681%2Farticle%2Fdetails%2F75252341%2F)
3. [iOS 编译OpenCV](https://www.jianshu.com/p/8e19c0f03493?utm_campaign=maleskine&utm_content=note&utm_medium=seo_notes&utm_source=recommendation)