import { reactive } from "./reactive.js";
import { effect } from './effect.js';
import { ref } from "./ref.js";

const state = ref(1);

effect(() => {
  console.log('effect', state.value);
})

state.value++