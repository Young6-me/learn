import { reactive } from './reactive.js';
import { effect } from './effect.js';
import { computed } from './computed.js';

const state = reactive({
  a: 1,
  b: 2,
});
// watchEffect
// watch
const sum = computed(() => {
  console.log('computed');
  return state.a + state.b;
});

effect(() => {
  console.log('render', sum.value);
});

state.a++;
