'use strict';

/**
 * @file 速度计算器（速率采样器）
 * 
 * 功能：计算数据传输的平均速率（字节/秒），使用滑动窗口采样算法。
 * 这是进度事件系统中速率计算的核心组件，用于实时估算传输速度。
 * 
 * 设计特点：
 * 1. 环形缓冲区：使用固定大小的数组存储最近的样本，避免内存增长
 * 2. 滑动窗口：只考虑最近N个样本，快速反映当前速率变化
 * 3. 最小时间窗：避免在初始阶段计算不准确的速率
 * 4. 实时计算：每次新样本到达时立即计算最新速率
 * 
 * 算法原理：维护两个环形数组（bytes和timestamps），分别存储每个数据块的字节数和时间戳。
 * 计算从tail到head（不包括head）的所有样本的总字节数和时间差，然后计算平均速率。
 */

/**
 * 速度计算器工厂函数
 * 
 * 功能：创建并返回一个速率计算函数，该函数维护内部状态并计算实时速率。
 * 
 * 算法步骤：
 * 1. 初始化环形缓冲区（bytes和timestamps数组）
 * 2. 维护head（写入位置）和tail（读取位置）指针
 * 3. 每次调用push(chunkLength)时：
 *    a. 记录当前时间戳和字节数
 *    b. 更新head指针
 *    c. 如果缓冲区满，移动tail指针（淘汰最旧样本）
 *    d. 计算从tail到head的所有样本的总字节数和时间差
 *    e. 如果总时间小于min，返回undefined（数据不足）
 *    f. 计算速率：总字节数 * 1000 / 时间差（毫秒）→ 字节/秒
 * 
 * 环形缓冲区管理：
 * - head: 下一个写入位置
 * - tail: 最旧样本的位置
 * - 当head === tail时，缓冲区满，需要移动tail淘汰旧样本
 * 
 * @param {Number} [samplesCount=10] - 采样窗口大小，保留的最近样本数量
 * @param {Number} [min=1000] - 最小计算时间（毫秒），避免初始阶段数据不足导致计算不准确
 * @returns {Function} 速率计算函数push(chunkLength)，返回速率（字节/秒）或undefined
 */
function speedometer(samplesCount, min) {
  samplesCount = samplesCount || 10;
  const bytes = new Array(samplesCount);
  const timestamps = new Array(samplesCount);
  let head = 0;
  let tail = 0;
  let firstSampleTS;

  min = min !== undefined ? min : 1000;

  return function push(chunkLength) {
    const now = Date.now();

    const startedAt = timestamps[tail];

    if (!firstSampleTS) {
      firstSampleTS = now;
    }

    bytes[head] = chunkLength;
    timestamps[head] = now;

    let i = tail;
    let bytesCount = 0;

    while (i !== head) {
      bytesCount += bytes[i++];
      i = i % samplesCount;
    }

    head = (head + 1) % samplesCount;

    if (head === tail) {
      tail = (tail + 1) % samplesCount;
    }

    if (now - firstSampleTS < min) {
      return;
    }

    const passed = startedAt && now - startedAt;

    return passed ? Math.round((bytesCount * 1000) / passed) : undefined;
  };
}

export default speedometer;
