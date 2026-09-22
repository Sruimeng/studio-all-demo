import { Engine } from "../core/type.js";

//#region src/composables/engine.d.ts
declare const useProvideEngine: (engine: any) => any;
declare const useEngine: () => Engine;
//#endregion
export { useEngine, useProvideEngine };