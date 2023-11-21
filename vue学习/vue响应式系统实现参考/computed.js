import { effect, track, trigger } from './effect.js';
import { TrackOpTypes, TriggerOpTypes } from './operations.js';

function normalizeParameter(getterOrOptions) {
  let getter, setter;
  if (typeof getterOrOptions === 'function') {
    getter = getterOrOptions;
    setter = () => {
      console.warn(`Computed property was assigned to but it has no setter.`);
    };
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  return { getter, setter };
}

export function computed(getterOrOptions) {
  const { getter, setter } = normalizeParameter(getterOrOptions);
  let value,
    dirty = true;
  const effetcFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true;
      trigger(obj, TriggerOpTypes.SET, 'value');
    },
  });
  const obj = {
    get value() {
      track(obj, TrackOpTypes.GET, 'value');
      if (dirty) {
        value = effetcFn();
        dirty = false;
      }
      return value;
    },
    set value(newValue) {
      setter(newValue);
    },
  };
  return obj;
}
