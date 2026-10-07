import { useSyncExternalStore } from 'react';
import { engine } from '../engine/moyuEngine';

/** 订阅引擎版本号，引擎 notify() 后触发重渲染 */
export function useEngine() {
  useSyncExternalStore(
    (fn) => engine.subscribe(fn),
    () => engine.getSnapshot()
  );
  return engine;
}
