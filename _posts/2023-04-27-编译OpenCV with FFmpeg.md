---
title: 编译Android OpenCV with FFmpeg静态库
date: '2023-04-27 T08:33:57+08:00'
author: zhaoyou
layout: post
permalink: /bian-yi-android-opencv-with-ffmpeg.html

views:
    - '50'
categories:
    - 巧记
tags:
    - [opencv, Android]
image:
  path: http://io.fifo.site/thumb-9.jpg
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

 

## 编译环境

- opencv : 4.6.0
- ndk: r21e
- os: mac m1 & 13.3.1



## 编译脚本

### 修改编译脚本

`opencv/platforms/android/build_sdk.py` 中 `build_library(self, abi, do_install)`函数改为如下

```python
def build_library(self, abi, do_install):
  cmd = [self.cmake_path, "-GNinja"]
  cmake_vars = dict(
      CMAKE_TOOLCHAIN_FILE=self.get_toolchain_file(),
      INSTALL_CREATE_DISTRIB="ON",
      WITH_OPENCL="OFF",
      BUILD_KOTLIN_EXTENSIONS="ON",
      WITH_IPP=("ON" if abi.haveIPP() else "OFF"),
      WITH_TBB="ON",
      BUILD_EXAMPLES="OFF",
      BUILD_TESTS="OFF",
      BUILD_PERF_TESTS="OFF",
      BUILD_DOCS="OFF",
      BUILD_ANDROID_EXAMPLES="OFF",
      INSTALL_ANDROID_EXAMPLES="OFF",
      BUILD_ANDROID_PROJECTS="OFF",
      WITH_FFMPEG="ON",
      OPENCV_FFMPEG_USE_FIND_PACKAGE="ON",
      FFMPEG_DIR="../",
  )
  if self.ninja_path != 'ninja':
      cmake_vars['CMAKE_MAKE_PROGRAM'] = self.ninja_path

  if self.debug:
      cmake_vars['CMAKE_BUILD_TYPE'] = "Debug"

  if self.debug_info:  # Release with debug info
      cmake_vars['BUILD_WITH_DEBUG_INFO'] = "ON"

  if self.opencl:
      cmake_vars['WITH_OPENCL'] = "ON"

  if self.no_kotlin:
      cmake_vars['BUILD_KOTLIN_EXTENSIONS'] = "OFF"

  if self.config.modules_list is not None:
      cmd.append("-DBUILD_LIST='%s'" % self.config.modules_list)

  if self.config.extra_modules_path is not None:
      cmd.append("-DOPENCV_EXTRA_MODULES_PATH='%s'" % self.config.extra_modules_path)

  if self.use_ccache == True:
      cmd.append("-DNDK_CCACHE=ccache")
  if do_install:
      cmd.extend(["-DBUILD_TESTS=ON", "-DINSTALL_TESTS=ON"])

  cmake_vars.update(abi.cmake_vars)
  cmd += [ "-D%s='%s'" % (k, v) for (k, v) in cmake_vars.items() if v is not None]
  cmd.append(self.opencvdir)
  execute(cmd)
  # full parallelism for C++ compilation tasks
  execute([self.ninja_path, "opencv_modules"])
  # limit parallelism for building samples (avoid huge memory consumption)
  if self.no_samples_build:
      execute([self.ninja_path, "install" if (self.debug_info or self.debug) else "install/strip"])
  else:
      execute([self.ninja_path, "-j1" if (self.debug_info or self.debug) else "-j3", "install" if (self.debug_info or self.debug) else "install/strip"])
```

主要是增加一下编译参数放开ffmpeg依赖，以及关闭java相关的编译

```python
BUILD_ANDROID_EXAMPLES="OFF",
INSTALL_ANDROID_EXAMPLES="OFF",
BUILD_ANDROID_PROJECTS="OFF",
WITH_FFMPEG="ON",
OPENCV_FFMPEG_USE_FIND_PACKAGE="ON",
FFMPEG_DIR="../",
```

### FFmpeg依赖指定

创建 `ffmpeg-config.cmake`文件，修改为以下内容，放到和编译opencv同级目录，用来指定ffmpeg依赖的静态库的位置和头文件位置。

```python

set(FFMPEG_LIBDIR "${CMAKE_CURRENT_LIST_DIR}/../../../libs/mediautils/android/${CMAKE_ANDROID_ARCH_ABI}/Release/ffmpeg")
set(FFMPEG_INCLUDE_DIRS "${CMAKE_CURRENT_LIST_DIR}/../../../include/mediautils/ffmpeg")

set(FFMPEG_LIBRARIES
    ${FFMPEG_LIBDIR}/libavformat.a
    ${FFMPEG_LIBDIR}/libavcodec.a
    ${FFMPEG_LIBDIR}/libavutil.a
    ${FFMPEG_LIBDIR}/libswscale.a
    ${FFMPEG_LIBDIR}/libswresample.a
    ${FFMPEG_LIBDIR}/libavfilter.a
    ${CMAKE_CURRENT_LIST_DIR}/../../../libs/mediautils/android/${CMAKE_ANDROID_ARCH_ABI}/Release/zpx264/libx264.a
    z
)

set(FFMPEG_libavformat_FOUND TRUE)
set(FFMPEG_libavcodec_FOUND TRUE)
set(FFMPEG_libavutil_FOUND TRUE)
set(FFMPEG_libswscale_FOUND TRUE)
set(FFMPEG_libswresample_FOUND TRUE)
set(FFMPEG_libavfilter_FOUND TRUE)


set(FFMPEG_libavcodec_VERSION 59.18.100)
set(FFMPEG_libavfilter_VERSION 8.24.100)
set(FFMPEG_libavformat_VERSION 59.16.100)
set(FFMPEG_libavutil_VERSION 57.17.100)
set(FFMPEG_libswresample_VERSION 4.3.100)
set(FFMPEG_libswscale_VERSION 6.4.100)

set(FFMPEG_FOUND TRUE)
set(FFMPEG_LIBS ${FFMPEG_LIBRARIES})
```

> 注意，没有依赖的静态库不要写到脚本中，可能会报错
> {: .prompt-warning }



### 添加编译脚本

创建`build-android.sh`, 内容如下，将此脚本放到和opencv源码同级目录

```shell
#!/bin/sh

echo "start build opencv android platform"
echo "Current PWD: ${PWD}"

#ndk-build
export ANDROID_NDK=/Users/admin/works/tools/ndk-r21e
export PATH=$PATH:$ANDROID_NDK

rm -rf opencv-build
mkdir opencv-build
cd opencv-build
mkdir static 
cd static

python3 ../../opencv/platforms/android/build_sdk.py ./ -Dand	
```

执行 `./build-android.sh` 即可



### 其他

编译过程中会下载TBB, 如下载不下来需要配置代理:

```bash
TBB: Downloading v2020.2.tar.gz from https://github.com/01org/tbb/archive/v2020.2.tar.gz	
```



## 参考：

[https://zhuanlan.zhihu.com/p/472115312?utm_id=0](https://zhuanlan.zhihu.com/p/472115312?utm_id=0) 非常详细

