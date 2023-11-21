import { track, trigger, pauseTracking, resumeTracking } from "./effect.js";
import { TrackOpTypes, TriggerOpTypes } from "./operarions.js";
import { reactive } from "./reactive.js";
import { isObject, hasChanged } from "./utils.js";

// 需要处理的数组方法
const arrayInstrumentations = {};
const RAW = Symbol('raw');

['includes', 'indexOf', 'lastIndexOf'].forEach((key) => {
  arrayInstrumentations[key] = function (...args) {
    // 1. 正常找
    let res = Array.prototype[key].apply(this, args);
    // 2. 找不到，从元素对象中在找一遍
    if(res < 0 || res === false) {
      res = Array.prototype[key].apply(this[RAW], args);
    }
    return res;
  }
});

['push', 'pop', 'shift', 'unshift', 'splice'].forEach((key) => {
  arrayInstrumentations[key] = function (...args) {
    pauseTracking(); // 暂停依赖收集
    let res = Array.prototype[key].apply(this, args);
    resumeTracking(); // 恢复依赖收集
    return res;
  }
});


function get(target, key, receiver){
  if(key === RAW) {
    return target;
  }

  // 依赖收集
  track(target, TrackOpTypes.GET, key);

  // 处理数组方法的逻辑
  if(arrayInstrumentations.hasOwnProperty(key) && Array.isArray(target)) {
    return arrayInstrumentations[key];
  }

  const result = Reflect.get(target, key, receiver);

  if(isObject(result)) {
    return reactive(result);
  }

  return result;
}

function set(target, key, value, receiver) {
  const type = target.hasOwnProperty(key) ? TriggerOpTypes.SET : TriggerOpTypes.ADD;

  const oldValue = target[key];
  const oldLen = Array.isArray(target) ? target.length : undefined;
  const result = Reflect.set(target, key, value, receiver);

  // 冻结对象或者是没啥setter 的属性，赋值可能不成功
  if(!result) {
    return result;
  }
  
  const newLen = Array.isArray(target) ? target.length : undefined;

  if(hasChanged(oldValue, value) || type === TriggerOpTypes.ADD) {
    // 派发更新
    trigger(target, type,  key);
    if(Array.isArray(target) && oldLen !== newLen) {
      if(key !== 'length') {
        trigger(target, TriggerOpTypes.SET, 'length');
      } else {
        // 数组length变小，找到那些被删除的下标，依次触发派发更新
        for(let i = newLen; i < oldLen; i++) {
          trigger(target, TriggerOpTypes.DELETE, i.toString())
        }
      }
    }
  }
  
  return result;
}

function deleteProperty(target, key) {
  const hasKey = target.hasOwnProperty(key);
  // 可能是冻结对象 删除不成功
  const result = Reflect.deleteProperty(target, key);
  if(hasKey && result) {
    trigger(target, TriggerOpTypes.DELETE, key);
  }
  return result
}

function has(target, key) {
  // 依赖收集 例如： 'x' in obj 形式
  track(target, TrackOpTypes.HAS, key);
  return Reflect.has(target, key);
}

function ownKeys(target) {
  // 依赖收集 例如： for...in 形式
  track(target, TrackOpTypes.ITERATE);
  return Reflect.ownKeys(target);
}

export const handlers = {
  get,
  set,
  has,
  ownKeys,
  deleteProperty
}