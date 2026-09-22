import { Engine, SystemHook, SystemState } from "../core/type.js";
import "../core/index.js";
import { ComputedRef, Reactive } from "vue";

//#region src/utils/system.d.ts
declare const defineSystem: <T extends object>(name: string, setup: (params: SystemHook & SystemState) => T) => {
  (): Reactive<T & SystemState>;
  (engine: Engine): ComputedRef<Reactive<T & SystemState> | undefined>;
};
//#endregion
export { defineSystem };