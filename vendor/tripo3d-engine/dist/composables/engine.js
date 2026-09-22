import { createInjectionState } from "@vueuse/core";

//#region src/composables/engine.ts
const [useProvideEngine, _useEngine] = createInjectionState((engine) => engine);
const useEngine = () => {
	const context = _useEngine();
	if (!context) throw new Error(`useEngine must be used within a Engine component`);
	return context;
};

//#endregion
export { useEngine, useProvideEngine };