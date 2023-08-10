---
id: 127
title: WebRTC中PacedSender工作分析
date: '2023-03-12T21:40:20+08:00'
author: zhaoyou
layout: post
guid: 'https://fifo.site/?p=127'
permalink: /webrtc-zhongpacedsender-gong-zuo-fen-xi.html
views:
    - '44'
categories:
    - RTC
image:
  path: http://io.fifo.site/typora202302-webrtc-good-thing.jpg
  thumb:  
    enable: true
    size: 'small' #small, medium, large
---

摘抄一段 `PacedSender` 简介，下面的链接对该模块的工作原理做了详细的介绍，今天大致看了下这个模块的代码，记录一下

> 在estimator根据网络状态决策出新的通信码率（target bitrate），它会将这个码率设置到pacer当中，要求pacer按照新的码率来计算发包频率。因为在视频通信中，单帧视频可能有上百KB,如果是当视频帧被编码器编码出来后，就立即进行RTP打包发送，瞬时会发送大量的数据到网络上，可能会引起网络衰减和通信恶化。WebRTC引入pacer，pacer会根据estimator评估出来的码率，按照最小单位时间（5ms）做时间分片进行递进发送数据，避免瞬时对网络的冲击。**pacer的目的就是让视频数据按照评估码率均匀的分布在各个时间片里发送，** 所以在弱网的WiFi环境，pacer是个非常重要的关键步骤
> 
> via: [http://livevideostack.com/portal.php?mod=view&amp;aid=201](http://livevideostack.com/portal.php?mod=view&aid=201)

##  PacedSender 发送速率设置

GCC 估测的带宽只会通过 `SetEstimatedBitrate` 方法设置到 `PacedSender` 中， `pacing_bitrate_kbps_` 为 `PacedSender` 发送媒体包的速率，为GCC估测带宽 乘以了固定系数 kDefaultPaceMultiplier(2.5)

```c
void PacedSender::SetEstimatedBitrate(uint32_t bitrate_bps) {
  if (bitrate_bps == 0)
    LOG(LS_ERROR) << "PacedSender is not designed to handle 0 bitrate.";
  CriticalSectionScoped cs(critsect_.get());
  estimated_bitrate_bps_ = bitrate_bps;
  padding_budget_->set_target_rate_kbps(estimated_bitrate_bps_ / 1000 );

  // 更新 pacing 发送速率，为 estimated_bitrate_bps_/1000 * 2.5;
  pacing_bitrate_kbps_ =
      max(min_send_bitrate_kbps_, estimated_bitrate_bps_ / 1000) *
      kDefaultPaceMultiplier;
  alr_detector_->SetEstimatedBitrate(bitrate_bps);
}

```

## PacedSender 包缓存队列

该方法由 `rtp_sender` 模块调用，将封装好的视频`rtp`包的元信息，如 `ssrc`, `sequence_number`等封装成`Packet`数据结构存储到队列中，并未缓存真正的媒体数据。发包时，`PacedSender` 会通过这些元信息，在`rtp_sender`中的缓存队列中找到对应的媒体包数据

```c
// 将视频包元信息，instert到pacer中
void PacedSender::InsertPacket(RtpPacketSender::Priority priority,
                               uint32_t ssrc,
                               uint16_t sequence_number,
                               int64_t capture_time_ms,
                               size_t bytes,
                               bool retransmission) {
  CriticalSectionScoped cs(critsect_.get());
  DCHECK(estimated_bitrate_bps_ > 0)
        << "SetEstimatedBitrate must be called before InsertPacket.";

  int64_t now_ms = clock_->TimeInMilliseconds();
  prober_->OnIncomingPacket(bytes);

  if (capture_time_ms < 0)
    capture_time_ms = now_ms;

  // 封装 packet 包，放到list中 packets_
  packets_->Push(paced_sender::Packet(priority, ssrc, sequence_number,
                                      capture_time_ms, now_ms, bytes,
                                      retransmission, packet_counter_++));
}

```

##  发包线程

###  线程发包间隔 5ms 计算

`PacedSender` 发送线程是调用时间间隔为5ms，为什么是5ms, 通过模块中下面的方法计算的：

```c
// 计算线程调用的时间间隔，即下面 process() 方法调用的时间间隔 ！！！！
int64_t PacedSender::TimeUntilNextProcess() {
  CriticalSectionScoped cs(critsect_.get());
    //  如果正在探测
    if (prober_->IsProbing()) {
    int64_t ret = prober_->TimeUntilNextProbe(clock_->TimeInMilliseconds());
    if (ret > 0 || (ret == 0 && !probing_send_failure_))
      return ret;
  }
  // 当前时间 减去 上一次 process（）方法调用的时间，得出时间间隔
  int64_t elapsed_time_us = clock_->TimeInMicroseconds() - time_last_update_us_;
  int64_t elapsed_time_ms = (elapsed_time_us + 500) / 1000;
    
  // kMinPacketLimitMs：5ms，即 process() 方法 5m 处理一次
  return std::max<int64_t>(kMinPacketLimitMs - elapsed_time_ms, 0);
}

```

`kMinPacketLimitMs` 的值为固定 5ms, `elapsed_time_ms`从代码中可以看出，为上一次调用 `process`到现在的时间间隔，两个的时间差即为线程要等待的时长，最大5ms，之后线程会再次调用`process` 方法发送媒体数据。

###  线程处理方法 process()

下面的 `process()` 方法中处理真正发包逻辑， 每次进入 `process` 都会调用 `UpdateBudgetWithElapsedTime(elapsed_time_ms)`, 去更新(增加) `media_budget_`中的 `bytes_remaining_` ,

`bytes_remaining_` 为每次可以发送包的最大字节数：

> 发包量 = Δt x GCC反馈带宽 x 2.5

Δt 即`elapsed_time_ms`, 最大 5ms。 在下面的`while` 循环中，只要包队列不为空，就一直尝试用`SendPacket`去发包。

```c
int32_t PacedSender::Process() {
  int64_t now_us = clock_->TimeInMicroseconds();
  CriticalSectionScoped cs(critsect_.get());
    // elapsed_time_ms: 上一次process和这次process 之间的时间间隔 elapsed_time_ms  ms
  int64_t elapsed_time_ms = (now_us - time_last_update_us_ + 500) / 1000;
  time_last_update_us_ = now_us;
  int target_bitrate_kbps = pacing_bitrate_kbps_; // 拿到最新的 pacer 发送速率
  if (!paused_ && elapsed_time_ms > 0) {
    // 缓存的所有的包的大小，按字节算
    size_t queue_size_bytes = packets_->SizeInBytes();
    if (queue_size_bytes > 0) {
      // Assuming equal size packets and input/output rate, the average packet
      // has avg_time_left_ms left to get queue_size_bytes out of the queue, if
      // time constraint shall be met. Determine bitrate needed for that.
      packets_->UpdateQueueTime(clock_->TimeInMilliseconds());
      int64_t avg_time_left_ms = std::max<int64_t>(
          1, kMaxQueueLengthMs - packets_->AverageQueueTimeMs()); // 这个地方应该是 已经缓存包时长 = 最大缓存时长 - 剩余队列时长
      int min_bitrate_needed_kbps =
          static_cast<int>(queue_size_bytes * 8 / avg_time_left_ms);
      if (min_bitrate_needed_kbps > target_bitrate_kbps)
        target_bitrate_kbps = min_bitrate_needed_kbps; // 如果计算出来的发送速率比上面传入的 目标发送码率大，则更新目标发送码率
    }
    //  media budget 更新发送速率
    media_budget_->set_target_rate_kbps(target_bitrate_kbps);
    // 最大时间间隔 kMaxIntervalTimeMs = 30 ms
    elapsed_time_ms = min(kMaxIntervalTimeMs, elapsed_time_ms);
    UpdateBudgetWithElapsedTime(elapsed_time_ms);
  }

  bool is_probing = prober_->IsProbing();
  PacedPacketInfo pacing_info;
  size_t bytes_sent = 0;
  size_t recommended_probe_size = 0;
  if (is_probing) {
    pacing_info = prober_->CurrentCluster();
    recommended_probe_size = prober_->RecommendedMinProbeSize();
  }
    
  // 队列不为空的情况下
  while (!packets_->Empty()) {
    // Since we need to release the lock in order to send, we first pop the
    // element from the priority queue but keep it in storage, so that we can
    // reinsert it if send fails.
    const paced_sender::Packet& packet = packets_->BeginPop();
    // 去除 队列中的包，并开始发送
    if (SendPacket(packet, pacing_info)) {
      // Send succeeded, remove it from the queue.
      // 发送成功，则记录发送的字节数，并从队列中将包清除
      bytes_sent += packet.bytes;
      packets_->FinalizePop(packet);
//        探测期间，或发送字节数超过探测的数值了，则跳出循环不再发送   这个地方和探测有关，是否有问题？？？
      if (is_probing && bytes_sent > recommended_probe_size)
        break;
    } else {
      // Send failed, put it back into the queue.
      packets_->CancelPop(packet);
      break;
    }
  }

  if (packets_->Empty() && !paused_) {
    // We can not send padding unless a normal packet has first been sent. If we
    // do, timestamps get messed up.
    if (packet_counter_ > 0) {
    // 计算是否应该发送 padding 包
    int padding_needed = static_cast<int>(is_probing ? (recommended_probe_size - bytes_sent) : padding_budget_->bytes_remaining());
        
        if (padding_needed > 0) {
          bytes_sent += SendPadding(padding_needed, pacing_info);
        }
    }
  }
    
  if (is_probing) {
    probing_send_failure_ = bytes_sent == 0;
    if (!probing_send_failure_)
      prober_->ProbeSent(clock_->TimeInMilliseconds(), bytes_sent);
  }
  alr_detector_->OnBytesSent(bytes_sent, now_us / 1000);

  return 0;
}

```

###  发包方法SendPacket()

该方法由上面的while发包循环调用，发包后会调用 `UpdateBudgetWithBytesSent(packet.bytes)` 从 `media_budget_` 减去`packet.bytes`长度的发包预算, 当发博包循环走几次之后，`media_budget`中的预算长度被消耗完，即 &lt;= 0， 此时 `media_budget_->bytes_remaining()` 方法会做 `max(0, bytes_remaining_)` 处理，即返回0 ，而发包前会判断 `media_budget_->bytes_remaining() == 0` ,满足条件就`return false`不发了。

```c
bool PacedSender::SendPacket(const paced_sender::Packet& packet,
                             const PacedPacketInfo& pacing_info) {
    // 是否暂停发包
    if (paused_)
    return false;
    
    
    //  media  budget 剩余预算字节数为 0，停止发包
  if (media_budget_->bytes_remaining() == 0 &&
      pacing_info.probe_cluster_id == PacedPacketInfo::kNotAProbe) {
    return false;
  }

  critsect_->Enter();
  const bool success = packet_sender_->TimeToSendPacket(
      packet.ssrc, packet.sequence_number, packet.capture_time_ms,
      packet.retransmission, pacing_info);
  critsect_->Leave();

  if (success) {
    // TODO(holmer): High priority packets should only be accounted for if we
    // are allocating bandwidth for audio.
    if (packet.priority != kHighPriority) { // 包的优先级不为最高优先级，更新发送的字节数
      // Update media bytes sent.
      UpdateBudgetWithBytesSent(packet.bytes);
    }
  }

  return success;
}

```

`SendPacket` 方法最终会调用 `rtp_sender`中的方法，将`ssrc`，`sequence_number` 等参数传递过去，`rtp_sender`通过这些值找到真正的视频媒体包，最终发送到到网络上。

##  media\_budget简介

`media_budget` 是在 `PacedSender`中封装的一个类，全部代码如下，注释做了解释：

```c
class IntervalBudget {
 public:
  explicit IntervalBudget(int initial_target_rate_kbps)
      : target_rate_kbps_(initial_target_rate_kbps),
        bytes_remaining_(0) {}

  void set_target_rate_kbps(int target_rate_kbps) {
    //更新发送速率
    target_rate_kbps_ = target_rate_kbps;
      bytes_remaining_ =
        max(-kWindowMs * target_rate_kbps_ / 8, bytes_remaining_);
  }

  void IncreaseBudget(int64_t delta_time_ms) {
    // 估计在 delta 时间， 在带宽为 target_rate_kbps 的情况可以发送出去多少字节
    int64_t bytes = target_rate_kbps_ * delta_time_ms / 8;
      
    if (bytes_remaining_ < 0) {
      // We overused last interval, compensate this interval.
      bytes_remaining_ = bytes_remaining_ + bytes;
    } else {
      // If we underused last interval we can't use it this interval.
      bytes_remaining_ = bytes;
    }
  }

  //更新实际发送的字节数， 从bytes_remaining_减去
  void UseBudget(size_t bytes) {
    bytes_remaining_ = max(bytes_remaining_ - static_cast<int>(bytes),
                                -kWindowMs * target_rate_kbps_ / 8);
  }
  // 几次发送循环后，发送的总字节数大于开始的 bytes_remaining_，bytes_remaining_ <= 0，改方法返回0
  size_t bytes_remaining() const {
    return static_cast<size_t>(max(0, bytes_remaining_));
  }

  int target_rate_kbps() const { return target_rate_kbps_; }

 private:
  static const int kWindowMs = 500; // window 500 ms

  int target_rate_kbps_;
  int bytes_remaining_;
};

```

##  PacedSender 原理总结

到这可以知道`PacedSender`工作原理了, 每次发包前会更新`media_budget`中预算`bytes_remaining_` 的大小，而每次发送时间(&lt;= 5ms)内最多发送 `bytes_remaining_` 字节数，从而达到限制和平滑带宽的目的，`PacedSender` 中 `padding`发送的原理和此类似。
 
