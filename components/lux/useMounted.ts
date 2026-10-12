'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// false during server render and hydration, true afterwards. Use it to gate
// clock- or locale-dependent text that would otherwise mismatch the static prerender.
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
