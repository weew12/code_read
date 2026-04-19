'use strict';

/**
 * @file 配置合并模块
 * 
 * 功能：将两个配置对象深度合并为一个新的配置对象。
 * 这是axios配置系统的核心，支持不同配置属性的不同合并策略。
 * 
 * 设计架构：
 * 1. 策略模式：为不同类型的配置属性定义不同的合并策略函数
 * 2. 深度合并：支持嵌套对象的递归合并
 * 3. 安全性：避免原型污染和意外属性继承
 * 4. 灵活性：支持请求级别配置覆盖实例级别配置
 * 
 * 合并层次：
 * 1. 默认配置（lib/defaults/index.js）
 * 2. 实例配置（new Axios()时传入）
 * 3. 请求配置（axios.request()时传入）
 * 
 * 核心思想：后面的配置优先于前面的配置，但不同属性有不同的优先级规则。
 */

import utils from '../utils.js';            // 工具函数
import AxiosHeaders from './AxiosHeaders.js';  // 头部管理类

/**
 * 将AxiosHeaders实例转换为普通对象的辅助函数
 * 
 * 设计目的：headers属性需要特殊处理，因为AxiosHeaders实例有自定义的合并逻辑。
 * 此函数确保在合并前将AxiosHeaders转换为普通对象，以便使用标准的对象合并。
 * 
 * @param {*} thing - 可能是AxiosHeaders实例或普通对象
 * @returns {Object} 普通对象
 */
const headersToObject = (thing) => (thing instanceof AxiosHeaders ? { ...thing } : thing);

/**
 * 配置合并主函数
 * 
 * 算法概要：
 * 1. 初始化：确保config2不为null/undefined，创建新的配置对象
 * 2. 定义合并策略函数：针对不同类型的属性有不同的合并逻辑
 * 3. 建立合并映射表：将配置属性映射到对应的合并策略
 * 4. 遍历所有属性：合并config1和config2中的所有属性
 * 5. 应用安全过滤：避免原型污染攻击
 * 6. 选择合并策略：根据属性名选择适当的合并函数
 * 7. 计算合并值：应用选定的合并策略
 * 8. 设置最终值：除非值为undefined且策略允许，否则设置到结果对象
 * 
 * 设计原则：
 * 1. 不变性：不修改输入对象，返回全新的配置对象
 * 2. 安全性：过滤危险属性（__proto__, constructor, prototype）
 * 3. 灵活性：支持属性特定的合并策略
 * 4. 明确性：undefined值的处理有明确的规则
 * 
 * @param {Object} config1 - 第一个配置对象（通常是默认配置或实例配置）
 * @param {Object} config2 - 第二个配置对象（通常是请求特定配置）
 * @returns {Object} 合并后的新配置对象
 */
export default function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config2 = config2 || {};  // 确保 config2 不是 null 或 undefined
  const config = {};        // 创建新的配置对象，避免修改原始配置

  /**
   * 获取合并后的值（核心合并逻辑）
   * 
   * 决策树：
   * 1. 如果target和source都是普通对象 → 深度合并（使用utils.merge）
   * 2. 如果只有source是普通对象 → 创建source的副本
   * 3. 如果source是数组 → 创建数组的浅拷贝
   * 4. 其他情况 → 直接返回source值
   * 
   * 设计考虑：
   * 1. 对象深度合并：确保嵌套配置正确合并
   * 2. 数组浅拷贝：避免修改原始数组，但数组元素是引用
   * 3. 基本值直接使用：字符串、数字、布尔值等直接采用新值
   * 4. caseless参数：用于headers的大小写不敏感合并
   * 
   * @param {*} target - 目标值（来自config1，将被覆盖）
   * @param {*} source - 源值（来自config2，优先使用）
   * @param {string} prop - 属性名（用于调试和特殊处理）
   * @param {boolean} caseless - 是否大小写不敏感（用于头部合并）
   * @returns {*} 合并后的值
   */
  function getMergedValue(target, source, prop, caseless) {
    // 情况1：两者都是普通对象，深度合并
    if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
      return utils.merge.call({ caseless }, target, source);
    } else if (utils.isPlainObject(source)) {
      // 情况2：只有源值是普通对象，创建副本（避免修改原始对象）
      return utils.merge({}, source);
    } else if (utils.isArray(source)) {
      // 情况3：源值是数组，创建浅拷贝（避免修改原始数组）
      return source.slice();
    }
    // 情况4：其他类型（字符串、数字、函数等），直接返回源值
    return source;
  }

  /**
   * 深度合并属性（默认合并策略）
   * 
   * 优先级规则：
   * 1. 优先使用config2的值（b），如果b不是undefined
   * 2. 否则，使用config1的值（a），如果a不是undefined
   * 3. 否则，返回undefined
   * 
   * 设计目的：这是大多数配置属性的默认合并策略。
   * 它实现了"后面的配置覆盖前面的配置"的基本原则，但支持深度合并。
   * 
   * @param {*} a - config1的值（较早/较基础的配置）
   * @param {*} b - config2的值（较晚/较具体的配置）
   * @param {string} prop - 属性名
   * @param {boolean} caseless - 是否大小写不敏感
   * @returns {*} 合并后的值，或undefined
   */
  function mergeDeepProperties(a, b, prop, caseless) {
    // 优先级1：config2有值，使用config2的值（可能深度合并）
    if (!utils.isUndefined(b)) {
      return getMergedValue(a, b, prop, caseless);
    } else if (!utils.isUndefined(a)) {
      // 优先级2：config2无值但config1有值，使用config1的值
      return getMergedValue(undefined, a, prop, caseless);
    }
    // 两者都没有值，返回undefined
  }

  /**
   * 仅使用config2的值（请求特定属性策略）
   * 
   * 规则：只有当config2有值（不是undefined）时才使用该值。
   * 如果config2没有值（undefined），则完全忽略该属性。
   * 
   * 适用场景：请求特定的属性，这些属性不应该从默认配置继承。
   * 例如：url、method、data - 每个请求都应该明确指定这些属性。
   * 
   * 设计原因：避免意外继承。如果请求没有指定url，不应该使用默认url。
   * 
   * @param {*} a - config1的值（被忽略）
   * @param {*} b - config2的值
   * @returns {*} config2的值，或undefined（如果config2没有值）
   */
  // eslint-disable-next-line consistent-return
  function valueFromConfig2(a, b) {
    if (!utils.isUndefined(b)) {
      return getMergedValue(undefined, b);
    }
  }

  /**
   * 默认使用config2的值，否则使用config1的值（简单值策略）
   * 
   * 规则：
   * 1. 如果config2有值（不是undefined），使用config2的值
   * 2. 否则如果config1有值，使用config1的值
   * 3. 否则返回undefined
   * 
   * 与mergeDeepProperties的区别：
   * - 此函数不进行深度合并，直接使用getMergedValue(undefined, value)
   * - mergeDeepProperties会进行深度合并（如果值是对象）
   * 
   * 适用场景：简单值属性，不需要深度合并。
   * 例如：timeout、adapter、responseType等。
   * 
   * @param {*} a - config1的值
   * @param {*} b - config2的值
   * @returns {*} config2或config1的值，或undefined
   */
  // eslint-disable-next-line consistent-return
  function defaultToConfig2(a, b) {
    if (!utils.isUndefined(b)) {
      return getMergedValue(undefined, b);
    } else if (!utils.isUndefined(a)) {
      return getMergedValue(undefined, a);
    }
  }

  /**
   * 直接键合并：仅当属性在config2中存在时才合并
   * 
   * 规则：
   * 1. 如果prop在config2中（无论值是否为undefined），使用config2的值
   * 2. 否则如果prop在config1中，使用config1的值
   * 3. 否则不包含该属性
   * 
   * 特殊行为：即使config2[prop] === undefined，也会包含该属性。
   * 这与valueFromConfig2不同（valueFromConfig2会忽略undefined值）。
   * 
   * 适用场景：需要明确"缺失"与"设置为undefined"区别的属性。
   * 例如：validateStatus - 设置为undefined表示"不验证状态"。
   * 
   * @param {*} a - config1的值
   * @param {*} b - config2的值
   * @param {string} prop - 属性名
   * @returns {*} 合并后的值，或undefined（如果属性存在但值为undefined）
   */
  // eslint-disable-next-line consistent-return
  function mergeDirectKeys(a, b, prop) {
    // 情况1：属性在config2中（使用in运算符，检查包括undefined）
    if (prop in config2) {
      return getMergedValue(a, b);
    } else if (prop in config1) {
      // 情况2：属性只在config1中
      return getMergedValue(undefined, a);
    }
    // 情况3：属性在两者中都不存在，不返回任何值
  }

  /**
   * 配置属性合并策略映射表
   * 
   * 设计模式：策略模式（Strategy Pattern）
   * 每个配置属性根据其语义和用途，分配一个特定的合并策略函数。
   * 
   * 策略分类：
   * 1. valueFromConfig2: 请求特定属性，必须来自具体请求
   * 2. defaultToConfig2: 通用配置，优先使用新值，可回退到默认值
   * 3. mergeDirectKeys: 特殊属性，需要区分"缺失"和"设置为undefined"
   * 4. 自定义函数: 特殊处理（如headers需要大小写不敏感合并）
   * 5. 默认(mergeDeepProperties): 未列出的属性使用深度合并
   * 
   * 扩展性：添加新配置属性时，只需在此映射表中指定适当的策略。
   */
  const mergeMap = {
    // 请求特定属性：完全使用 config2 的值，覆盖 config1
    url: valueFromConfig2,        // 请求 URL（必须来自具体请求）
    method: valueFromConfig2,     // HTTP 方法
    data: valueFromConfig2,       // 请求体数据
    
    // 大多数配置属性：优先使用 config2，否则使用 config1
    baseURL: defaultToConfig2,    // 基础 URL
    transformRequest: defaultToConfig2,      // 请求数据转换函数
    transformResponse: defaultToConfig2,     // 响应数据转换函数
    paramsSerializer: defaultToConfig2,      // 参数序列化器
    timeout: defaultToConfig2,               // 超时时间
    timeoutMessage: defaultToConfig2,        // 超时消息
    withCredentials: defaultToConfig2,       // 跨域凭证
    withXSRFToken: defaultToConfig2,         // XSRF token 支持
    adapter: defaultToConfig2,               // 适配器
    responseType: defaultToConfig2,          // 响应类型
    xsrfCookieName: defaultToConfig2,        // XSRF cookie 名称
    xsrfHeaderName: defaultToConfig2,        // XSRF 头部名称
    onUploadProgress: defaultToConfig2,      // 上传进度回调
    onDownloadProgress: defaultToConfig2,    // 下载进度回调
    decompress: defaultToConfig2,            // 解压缩
    maxContentLength: defaultToConfig2,      // 最大响应内容长度
    maxBodyLength: defaultToConfig2,         // 最大请求体长度
    beforeRedirect: defaultToConfig2,        // 重定向前回调
    transport: defaultToConfig2,             // 传输选项（Node.js）
    httpAgent: defaultToConfig2,             // HTTP 代理（Node.js）
    httpsAgent: defaultToConfig2,            // HTTPS 代理（Node.js）
    cancelToken: defaultToConfig2,           // 取消令牌
    socketPath: defaultToConfig2,            // socket 路径（Node.js）
    responseEncoding: defaultToConfig2,      // 响应编码
    
    // 特殊属性：仅当 config2 中有该属性时才合并
    validateStatus: mergeDirectKeys,  // 状态验证函数
    
    /**
     * 头部特殊处理
     * 
     * 特殊要求：
     * 1. 需要将AxiosHeaders实例转换为普通对象
     * 2. 需要大小写不敏感合并（HTTP头部名称不区分大小写）
     * 3. 需要深度合并（头部可能有嵌套结构）
     * 
     * 实现：使用mergeDeepProperties策略，但先转换对象并设置caseless=true。
     */
    headers: (a, b, prop) =>
      mergeDeepProperties(headersToObject(a), headersToObject(b), prop, true),
  };

  /**
   * 主合并循环
   * 
   * 算法步骤：
   * 1. 获取所有属性键：config1和config2的并集
   * 2. 遍历每个属性：
   *    a. 安全检查：跳过危险属性（防止原型污染攻击）
   *    b. 策略选择：根据属性名选择合并策略
   *    c. 值计算：应用选定的合并策略
   *    d. 值设置：根据策略规则决定是否包含该值
   * 
   * 安全考虑：过滤__proto__、constructor、prototype等属性，
   * 防止恶意配置修改对象原型（原型污染攻击）。
   */
  utils.forEach(Object.keys({ ...config1, ...config2 }), function computeConfigValue(prop) {
    // 安全过滤：跳过可能引起原型污染的危险属性
    if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') return;
    
    // 策略选择：根据合并映射表选择合并策略，默认使用深度合并
    const merge = utils.hasOwnProp(mergeMap, prop) ? mergeMap[prop] : mergeDeepProperties;
    
    // 值计算：应用选定的合并策略
    const configValue = merge(config1[prop], config2[prop], prop);
    
    /**
     * 值设置逻辑：
     * 
     * 条件：(utils.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue)
     * 
     * 解释：
     * 1. 如果configValue是undefined 且 合并策略不是mergeDirectKeys → 不设置属性
     * 2. 否则 → 设置属性(config[prop] = configValue)
     * 
     * 原因：
     * - mergeDirectKeys策略允许undefined值（表示明确设置为undefined）
     * - 其他策略中，undefined表示"无值"，不应包含在最终配置中
     * 
     * 设计目的：确保配置对象只包含有意义的属性，减少噪音。
     */
    (utils.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
  });

  // 返回合并后的新配置对象
  return config;
}
