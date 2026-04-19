'use strict';

import utils from '../utils.js';

/**
 * 解析属性路径字符串为路径数组
 * 
 * 功能：将FormData字段名（如"foo[x][y][z]"、"foo.x.y.z"）解析为路径数组（如['foo', 'x', 'y', 'z']）。
 * 支持多种格式：方括号表示法、点表示法、连字符分隔、空格分隔。
 * 
 * 正则表达式匹配：/\w+|\[(\w*)]/g
 * - \w+：匹配单词字符（属性名）
 * - \[(\w*)]：匹配方括号内的单词字符（捕获组）
 * 
 * 空数组处理："[]"转换为空字符串，表示数组索引自动递增。
 * 
 * @param {string} name - 属性路径字符串
 * @returns {Array<string>} 路径数组
 */
function parsePropPath(name) {
  // foo[x][y][z]
  // foo.x.y.z
  // foo-x-y-z
  // foo x y z
  return utils.matchAll(/\w+|\[(\w*)]/g, name).map((match) => {
    return match[0] === '[]' ? '' : match[1] || match[0];
  });
}

/**
 * 将数组转换为对象（保持键值对应）
 * 
 * 功能：将稀疏数组或带数字键的数组转换为普通对象，数字键转换为字符串键。
 * 注意：此转换会丢失数组的length属性，将数组索引变为对象属性。
 * 
 * 使用场景：在FormData到JSON的转换中，当需要将数组转换为对象时使用。
 * 例如：将['a', 'b', 'c']转换为{'0':'a', '1':'b', '2':'c'}
 * 
 * @param {Array<any>} arr - 要转换的数组
 * @returns {Object} 转换后的对象
 */
function arrayToObject(arr) {
  const obj = {};
  const keys = Object.keys(arr);
  let i;
  const len = keys.length;
  let key;
  for (i = 0; i < len; i++) {
    key = keys[i];
    obj[key] = arr[key];
  }
  return obj;
}

/**
 * 将FormData对象转换为JavaScript对象（JSON格式）
 * 
 * 功能：解析multipart/form-data格式的FormData，重建为嵌套的JavaScript对象。
 * 这是toFormData的逆操作，用于在服务器端或测试中将FormData转换回对象。
 * 
 * 算法概述：
 * 1. 验证输入是否为有效的FormData对象
 * 2. 遍历FormData的每个条目（name-value对）
 * 3. 使用parsePropPath解析字段名为路径数组
 * 4. 使用buildPath函数根据路径将值插入到目标对象中
 * 5. 处理数组、嵌套对象、重复字段等复杂情况
 * 
 * 特殊处理：
 * - 防止__proto__污染：跳过名为"__proto__"的字段
 * - 数字键处理：数字键表示数组索引，自动转换为数组
 * - 重复字段：相同字段名的多个值自动转换为数组
 * - 空键名：自动分配数组索引
 * 
 * @param {FormData} formData - 要转换的FormData对象
 * @returns {Object<string, any> | null} 转换后的JavaScript对象，如果输入无效则返回null
 */
function formDataToJSON(formData) {
  /**
   * 递归构建路径函数（核心算法）
   * 
   * 功能：根据路径数组将值插入到目标对象的正确位置。
   * 处理逻辑：
   * 1. 获取当前路径段（name）
   * 2. 防止__proto__污染攻击
   * 3. 判断是否为数字键（数组索引）
   * 4. 如果是最后一段路径：将值插入目标
   * 5. 如果不是最后一段：递归处理下一级路径
   * 6. 根据返回值决定是否将数组转换为对象
   * 
   * @param {Array<string>} path - 路径数组
   * @param {any} value - 要插入的值
   * @param {Object|Array} target - 当前目标对象或数组
   * @param {number} index - 当前路径索引
   * @returns {boolean} 是否将数组转换为对象（true表示转换）
   */
  function buildPath(path, value, target, index) {
    let name = path[index++];

    if (name === '__proto__') return true;

    const isNumericKey = Number.isFinite(+name);
    const isLast = index >= path.length;
    name = !name && utils.isArray(target) ? target.length : name;

    if (isLast) {
      if (utils.hasOwnProp(target, name)) {
        target[name] = [target[name], value];
      } else {
        target[name] = value;
      }

      return !isNumericKey;
    }

    if (!target[name] || !utils.isObject(target[name])) {
      target[name] = [];
    }

    const result = buildPath(path, value, target[name], index);

    if (result && utils.isArray(target[name])) {
      target[name] = arrayToObject(target[name]);
    }

    return !isNumericKey;
  }

  if (utils.isFormData(formData) && utils.isFunction(formData.entries)) {
    const obj = {};

    utils.forEachEntry(formData, (name, value) => {
      buildPath(parsePropPath(name), value, obj, 0);
    });

    return obj;
  }

  return null;
}

export default formDataToJSON;
