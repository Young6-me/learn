import { track, trigger, pauseTracking, resumeTracking } from './effect.js';
import { hasChanged, isObject } from './utils.js';
import { reactive } from './reactive.js';
import { TrackOpTypes, TriggerOpTypes } from './operations.js';

const arrayInstrumentations = {};
const RAW = Symbol('raw');

['includes', 'indexOf', 'lastIndexOf'].forEach((key) => {
  arrayInstrumentations[key] = function (...args) {
    // this-->proxy
    // 1. 正常找
    const res = Array.prototype[key].apply(this, args);
    // 2. 找不到，从原始对象中重新找一遍
    if (res < 0 || res === false) {
      return Array.prototype[key].apply(this[RAW], args);
    }
    return res;
  };
});

['push', 'pop', 'shift', 'unshift', 'splice'].forEach((key) => {
  arrayInstrumentations[key] = function (...args) {
    pauseTracking(); // 暂停依赖收集
    const res = Array.prototype[key].apply(this, args);
    resumeTracking(); // 恢复依赖收集
    return res;
  };
});

function get(target, key, receiver) {
  if (key === RAW) {
    return target;
  }
  // 依赖收集
  track(target, TrackOpTypes.GET, key);
  if (arrayInstrumentations.hasOwnProperty(key) && Array.isArray(target)) {
    return arrayInstrumentations[key];
  }
  const result = Reflect.get(target, key, receiver); // 返回对象的相应属性值
  if (isObject(result)) {
    return reactive(result);
  }
  return result;
}

function set(target, key, value, receiver) {
  const type = target.hasOwnProperty(key)
    ? TriggerOpTypes.SET
    : TriggerOpTypes.ADD;
  const oldValue = target[key];
  const oldLen = Array.isArray(target) ? target.length : undefined;
  const result = Reflect.set(target, key, value, receiver);
  if (!result) {
    return result;
  }
  const newLen = Array.isArray(target) ? target.length : undefined;
  // 派发更新
  if (hasChanged(oldValue, value) || type === TriggerOpTypes.ADD) {
    trigger(target, type, key);
    if (Array.isArray(target) && oldLen !== newLen) {
      if (key !== 'length') {
        trigger(target, TriggerOpTypes.SET, 'length');
      } else {
        // 找到那些被删除的下标，依次触发派发更新
        for (let i = newLen; i < oldLen; i++) {
          trigger(target, TriggerOpTypes.DELETE, i.toString());
        }
      }
    }
  }
  return result; // 设置对象的相应属性值
}

function deleteProperty(target, key) {
  const hadKey = target.hasOwnProperty(key);
  const result = Reflect.deleteProperty(target, key); // 删除对象的相应属性值
  if (hadKey && result) {
    trigger(target, TriggerOpTypes.DELETE, key);
  }
  return result;
}

function has(target, key) {
  // 依赖收集
  track(target, TrackOpTypes.HAS, key);
  return Reflect.has(target, key); // 判断对象是否有相应属性值
}

function ownKeys(target) {
  // 依赖收集
  track(target, TrackOpTypes.ITERATE);
  return Reflect.ownKeys(target); // 返回对象的所有属性名
}

export const handlers = {
  get,
  set,
  has,
  ownKeys,
  deleteProperty,
};
