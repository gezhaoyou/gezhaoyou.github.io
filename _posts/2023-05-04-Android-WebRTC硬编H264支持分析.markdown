---
layout: post
title:  "Android-WebRTC硬编H264支持分析"
description: ""
author: zhaoyou
date:   2023-05-04 15:58:56 +0800
permalink: 8c5f9198.html
views:
    - '50'
categories:
    - 代码
tags:
    - 代码
image:
  path: http://io.fifo.site/thumb-5.jpg
  alt: title image
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

Android端Mediacodec 硬编限制比较多，仅支持base和high profile, 而且high profile对处理器做了限制，只支持三星的处理器:

`codecName.startsWith("OMX.Exynos.)"`，level 仅支持`3_1`，详细可以查看 `HardwareVideoEncoderFactory.java` 文件。

记录下调用的大概流程：

## h264_profile_level_id.cc

```c++
absl::optional<std::string> H264ProfileLevelIdToString(
    const H264ProfileLevelId& profile_level_id) {
  // Handle special case level == 1b.
  if (profile_level_id.level == H264Level::kLevel1_b) {
    switch (profile_level_id.profile) {
      case H264Profile::kProfileConstrainedBaseline:
        return {"42f00b"};
      case H264Profile::kProfileBaseline:
        return {"42100b"};
      case H264Profile::kProfileMain:
        return {"4d100b"};
      // Level 1b is not allowed for other profiles.
      default:
        return absl::nullopt;
    }
  }

  const char* profile_idc_iop_string;
  switch (profile_level_id.profile) {
    case H264Profile::kProfileConstrainedBaseline:
      profile_idc_iop_string = "42e0";
      break;
    case H264Profile::kProfileBaseline:
      profile_idc_iop_string = "4200";
      break;
    case H264Profile::kProfileMain:
      profile_idc_iop_string = "4d00";
      break;
    case H264Profile::kProfileConstrainedHigh:
      profile_idc_iop_string = "640c";
      break;
    case H264Profile::kProfileHigh:
      profile_idc_iop_string = "6400";
      break;
    case H264Profile::kProfilePredictiveHigh444:
      profile_idc_iop_string = "f400";
      break;
    // Unrecognized profile.
    default:
      return absl::nullopt;
  }

  char str[7];
  snprintf(str, 7u, "%s%02x", profile_idc_iop_string, profile_level_id.level);
  return {str};
}
```



##  webrtc_video_engine.cc

```c++

bool WebRtcVideoChannel::GetChangedSendParameters(
    const VideoSendParameters& params,
    ChangedSendParameters* changed_params) const {
  if (!ValidateCodecFormats(params.codecs) ||
      !ValidateRtpExtensions(params.extensions, send_rtp_extensions_)) {
    return false;
  }

  std::vector<VideoCodecSettings> negotiated_codecs =
      SelectSendVideoCodecs(MapCodecs(params.codecs));

  // We should only fail here if send direction is enabled.
  if (params.is_stream_active && negotiated_codecs.empty()) {
    RTC_LOG(LS_ERROR) << "No video codecs supported.";
    return false;
  }

  // Never enable sending FlexFEC, unless we are in the experiment.
  if (!IsEnabled(call_->trials(), "WebRTC-FlexFEC-03")) {
    for (VideoCodecSettings& codec : negotiated_codecs)
      codec.flexfec_payload_type = -1;
  }

  if (negotiated_codecs_ != negotiated_codecs) {
    if (negotiated_codecs.empty()) {
      changed_params->send_codec = absl::nullopt;
    } else if (send_codec_ != negotiated_codecs.front()) {
      changed_params->send_codec = negotiated_codecs.front();
    }
    changed_params->negotiated_codecs = std::move(negotiated_codecs);
  }

  // Handle RTP header extensions.
  if (params.extmap_allow_mixed != ExtmapAllowMixed()) {
    changed_params->extmap_allow_mixed = params.extmap_allow_mixed;
  }
  std::vector<webrtc::RtpExtension> filtered_extensions = FilterRtpExtensions(
      params.extensions, webrtc::RtpExtension::IsSupportedForVideo, true,
      call_->trials());
  if (send_rtp_extensions_ != filtered_extensions) {
    changed_params->rtp_header_extensions =
        absl::optional<std::vector<webrtc::RtpExtension>>(filtered_extensions);
  }

  if (params.mid != send_params_.mid) {
    changed_params->mid = params.mid;
  }

  // Handle max bitrate.
  if (params.max_bandwidth_bps != send_params_.max_bandwidth_bps &&
      params.max_bandwidth_bps >= -1) {
    // 0 or -1 uncaps max bitrate.
    // TODO(pbos): Reconsider how 0 should be treated. It is not mentioned as a
    // special value and might very well be used for stopping sending.
    changed_params->max_bandwidth_bps =
        params.max_bandwidth_bps == 0 ? -1 : params.max_bandwidth_bps;
  }

  // Handle conference mode.
  if (params.conference_mode != send_params_.conference_mode) {
    changed_params->conference_mode = params.conference_mode;
  }

  // Handle RTCP mode.
  if (params.rtcp.reduced_size != send_params_.rtcp.reduced_size) {
    changed_params->rtcp_mode = params.rtcp.reduced_size
                                    ? webrtc::RtcpMode::kReducedSize
                                    : webrtc::RtcpMode::kCompound;
  }

  return true;
}
```



## simulcast_encoder_adapter.cc

```c++
SimulcastEncoderAdapter::FetchOrCreateEncoderContext(
    bool is_lowest_quality_stream) const {
  bool prefer_temporal_support = fallback_encoder_factory_ != nullptr &&
                                 is_lowest_quality_stream &&
                                 prefer_temporal_support_on_base_layer_;

  // Toggling of `prefer_temporal_support` requires encoder recreation. Find
  // and reuse encoder with desired `prefer_temporal_support`. Otherwise, if
  // there is no such encoder in the cache, create a new instance.
  auto encoder_context_iter =
      std::find_if(cached_encoder_contexts_.begin(),
                   cached_encoder_contexts_.end(), [&](auto& encoder_context) {
                     return encoder_context->prefer_temporal_support() ==
                            prefer_temporal_support;
                   });

  std::unique_ptr<SimulcastEncoderAdapter::EncoderContext> encoder_context;
  if (encoder_context_iter != cached_encoder_contexts_.end()) {
    encoder_context = std::move(*encoder_context_iter);
    cached_encoder_contexts_.erase(encoder_context_iter);
  } else {
    std::unique_ptr<VideoEncoder> primary_encoder =
        primary_encoder_factory_->CreateVideoEncoder(video_format_);

    std::unique_ptr<VideoEncoder> fallback_encoder;
    if (fallback_encoder_factory_ != nullptr) {
      fallback_encoder =
          fallback_encoder_factory_->CreateVideoEncoder(video_format_);
    }

    std::unique_ptr<VideoEncoder> encoder;
    VideoEncoder::EncoderInfo primary_info;
    VideoEncoder::EncoderInfo fallback_info;

    if (primary_encoder != nullptr) {
      primary_info = primary_encoder->GetEncoderInfo();
      fallback_info = primary_info;

      if (fallback_encoder == nullptr) {
        encoder = std::move(primary_encoder);
      } else {
        encoder = CreateVideoEncoderSoftwareFallbackWrapper(
            std::move(fallback_encoder), std::move(primary_encoder),
            prefer_temporal_support);
      }
    } else if (fallback_encoder != nullptr) {
      RTC_LOG(LS_WARNING) << "Failed to create primary " << video_format_.name
                          << " encoder. Use fallback encoder.";
      fallback_info = fallback_encoder->GetEncoderInfo();
      primary_info = fallback_info;
      encoder = std::move(fallback_encoder);
    } else {
      RTC_LOG(LS_ERROR) << "Failed to create primary and fallback "
                        << video_format_.name << " encoders.";
      return nullptr;
    }

    encoder_context = std::make_unique<SimulcastEncoderAdapter::EncoderContext>(
        std::move(encoder), prefer_temporal_support, primary_info,
        fallback_info);
  }

  encoder_context->encoder().RegisterEncodeCompleteCallback(
      encoded_complete_callback_);
  return encoder_context;
}
```



---

然后调用到Java层

## HardwareVideoEncoderFactory.java

```java

@Nullable
@Override
public VideoEncoder createEncoder(VideoCodecInfo input) {
  VideoCodecMimeType type = VideoCodecMimeType.valueOf(input.getName());
  MediaCodecInfo info = findCodecForType(type);

  if (info == null) {
    return null;
  }

  String codecName = info.getName();
  String mime = type.mimeType();
  Integer surfaceColorFormat = MediaCodecUtils.selectColorFormat(
      MediaCodecUtils.TEXTURE_COLOR_FORMATS, info.getCapabilitiesForType(mime));
  Integer yuvColorFormat = MediaCodecUtils.selectColorFormat(
      MediaCodecUtils.ENCODER_COLOR_FORMATS, info.getCapabilitiesForType(mime));

  if (type == VideoCodecMimeType.H264) {
    boolean isHighProfile = H264Utils.isSameH264Profile(
        input.params, MediaCodecUtils.getCodecProperties(type, /* highProfile= */ true));
    boolean isBaselineProfile = H264Utils.isSameH264Profile(
        input.params, MediaCodecUtils.getCodecProperties(type, /* highProfile= */ false));

    if (!isHighProfile && !isBaselineProfile) {
      return null;
    }
    if (isHighProfile && !isH264HighProfileSupported(info)) {
      return null;
    }
  }

  return new HardwareVideoEncoder(new MediaCodecWrapperFactoryImpl(), codecName, type,
      surfaceColorFormat, yuvColorFormat, input.params, PERIODIC_KEY_FRAME_INTERVAL_S,
      getForcedKeyFrameIntervalMs(type, codecName), createBitrateAdjuster(type, codecName),
      sharedContext);
}
```



## HardwareVideoEncoder.java

```java

@Override
public VideoCodecStatus initEncode(Settings settings, Callback callback) {
  encodeThreadChecker.checkIsOnValidThread();

  this.callback = callback;
  automaticResizeOn = settings.automaticResizeOn;

  if (settings.width % REQUIRED_RESOLUTION_ALIGNMENT != 0
      || settings.height % REQUIRED_RESOLUTION_ALIGNMENT != 0) {
    Logging.e(TAG, "MediaCodec is only tested with resolutions that are 16x16 aligned.");
    return VideoCodecStatus.ERR_SIZE;
  }
  this.width = settings.width;
  this.height = settings.height;
  useSurfaceMode = canUseSurface();

  if (settings.startBitrate != 0 && settings.maxFramerate != 0) {
    bitrateAdjuster.setTargets(settings.startBitrate * 1000, settings.maxFramerate);
  }
  adjustedBitrate = bitrateAdjuster.getAdjustedBitrateBps();

  Logging.d(TAG,
      "initEncode: " + width + " x " + height + ". @ " + settings.startBitrate
          + "kbps. Fps: " + settings.maxFramerate + " Use surface mode: " + useSurfaceMode);
  return initEncodeInternal();
}
```

