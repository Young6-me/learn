import { TrackOpTypes, TriggerOpTypes } from "./operarions.js"
const targetMap = new WeakMap();
const ITERATE_KEY = Symbol('iterate');

let activeEffect = null;
const effectStack = [];
let shouldTrack = true;

export function pauseTracking() {
  shouldTrack = false;
}

export function resumeTracking() {
  shouldTrack = true;
}

export function effect(fn, options = {}) {
  const {lazy = false} = options;
  // 收集 依赖收集的环境，防止派发更新 重新依赖收集时，环境丢失
  const effectFn = () => {
    try {
      activeEffect = effectFn;
      effectStack.push(effectFn);
      // 清空依赖，重新收集
      cleanup(effectFn);
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  }
  // 记录被依赖关系，方便重新收集依赖
  effectFn.deps = [];
  effectFn.options = options;
  if(!lazy) {
    effectFn();
  }
  return effectFn;
}

export function cleanup(effectFn) {
  const { deps } = effectFn;
  if(!deps.length) {
    return;
  }
  for(const dep of deps) {
    dep.delete(effectFn);
  }
  deps.length = 0;
}

// 依赖收集
export function track(target, type, key) {
  if(!shouldTrack || !activeEffect) {
    return;
  }
  let propMap = targetMap.get(target);
  if(!propMap) {
    propMap = new Map();
    targetMap.set(target, propMap);
  }

  // 抹平for..in 没有key 的情况
  if(type === TrackOpTypes.ITERATE) {
    key = ITERATE_KEY;
  }

  let typeMap = propMap.get(key);
  if(!typeMap) {
    typeMap = new Map();
    propMap.set(key, typeMap);
  }

  let depSet = typeMap.get(type);

  if(!depSet) {
    depSet = new Set();
    typeMap.set(type, depSet);
  }

  if(!depSet.has(activeEffect)) {
    depSet.add(activeEffect);
    activeEffect.deps.push(depSet);
  }
}

// 派发更新
export function trigger (target, type,  key) {
  const effectFns = getEffectFns(target, type, key);
  if(!effectFns) {
    return;
  }
  for(const effectFn of effectFns) {
    // 防止依赖收集过程中，又派发自身函数的执行，导致无限递归循环
    if(effectFn === activeEffect) {
      continue;
    }
    if(effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  }
}

function getEffectFns(target, type, key) {
  const propMap = targetMap.get(target);
  if(!propMap) {
    return;
  }

  const keys = [key];
  // 处理for..in 添加的特殊属性ITERATE_KEY
  if(type === TriggerOpTypes.ADD || type === TriggerOpTypes.DELETE) {
    keys.push(ITERATE_KEY);
  }
  const effectFns = new Set();
  const triggerTypeMap = {
    [TriggerOpTypes.SET]: [TrackOpTypes.GET],
    [TriggerOpTypes.ADD]: [
      TrackOpTypes.GET, 
      TrackOpTypes.HAS, 
      TrackOpTypes.ITERATE
    ],
    [TriggerOpTypes.DELETE]: [
      TrackOpTypes.GET, 
      TrackOpTypes.HAS, 
      TrackOpTypes.ITERATE
    ]
  };

  for(const key of keys) {
    const typeMap = propMap.get(key);
    if(!typeMap) {
      continue;
    }
    const trackTypes = triggerTypeMap[type];
    for(const trackType of trackTypes) {
      const dep = typeMap.get(trackType);
      if(!dep) {
        continue;
      }
      for(const effectFn of dep) {
        effectFns.add(effectFn);
      }
    }
  }
  return effectFns;
}