---
id: 122
title: 'MacOS Big Sur后GN生成WebRTC工程报错'
date: '2023-03-12T21:36:32+08:00'
author: zhaoyou
layout: post
guid: 'https://fifo.site/?p=122'
permalink: /macos-big-sur-hougn-sheng-chengwebrtc-gong-cheng-b.html
views:
    - '36'
categories:
    - RTC
image:
  path: http://io.fifo.site/thumb-6.jpg
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

生成工程命令：

> gn gen out/ios\_64\_debug –args=’target\_os="ios" target\_cpu="arm64" ios\_enable\_code\_signing=false’ –ide=xcode

报错:

```bash
ERROR at //build/config/mac/mac_sdk.gni:106:7: Script returned non-zero exit code.
      exec_script("//build/mac/find_sdk.py", find_sdk_args, "list lines")
      ^----------
Current dir: /Users/admin/Repos/webrtc_all/webrtc/src/out/ios_64_debug/
Command: python /Users/admin/Repos/webrtc_all/webrtc/src/build/mac/find_sdk.py --print_sdk_path --print_bin_path 10.12
Returned 1.
stderr:

Traceback (most recent call last):
  File "/Users/admin/Repos/webrtc_all/webrtc/src/build/mac/find_sdk.py", line 97, in <module>
    print(main())
  File "/Users/admin/Repos/webrtc_all/webrtc/src/build/mac/find_sdk.py", line 80, in main
    raise Exception('No %s+ SDK found' % min_sdk_version)
Exception: No 10.12+ SDK found

See //build/toolchain/mac/BUILD.gn:15:1: whence it was imported.
import("//build/config/mac/mac_sdk.gni")
^--------------------------------------
See //BUILD.gn:29:3: which caused the file to be included.
  group("default") {
  ^-----------------

```

`Exception: No 10.12+ SDK found`, 大意就是10.12+ 的SDK找不到，报错文件`webrtc/src/build/mac/find_sdk.py` 80行。代码如下：

```python
  if not os.path.isdir(sdk_dir):
    raise SdkError('Install Xcode, launch it, accept the license ' +
      'agreement, and run `sudo xcode-select -s /path/to/Xcode.app` ' +
      'to continue.')
  sdks = [re.findall('^MacOSX(10\.\d+)\.sdk$', s) for s in os.listdir(sdk_dir)]
  sdks = [s[0] for s in sdks if s]  # [['10.5'], ['10.6']] => ['10.5', '10.6']
  sdks = [s for s in sdks  # ['10.5', '10.6'] => ['10.6']
          if parse_version(s) >= parse_version(min_sdk_version)]
  if not sdks:
    raise Exception('No %s+ SDK found' % min_sdk_version)
  best_sdk = sorted(sdks, key=parse_version)[0]


```

因为MacOS Big Sur版本号改为了11.x，程序搜索的版本号是10开头的，所以查找不到，改为11后 work fine：

```python
  sdks = [re.findall('^MacOSX(11\.\d+)\.sdk$', s) for s in os.listdir(sdk_dir)]

```