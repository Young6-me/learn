import { isObject } from "./utils.js";
import { handlers } from './handlers.js'
const targetMap = new WeakMap();
export function reactive(target) {
  if(!isObject(target)) {
    return target; // 如果不是对象，直接返回
  }
  if(targetMap.has(target)) {
    return targetMap.get(target); // 如果已经代理，直接返回
  }
  const proxy = new Proxy(target, handlers);
  targetMap.set(target, proxy);
  return proxy;
}