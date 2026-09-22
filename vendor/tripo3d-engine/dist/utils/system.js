import { useEngine } from "../composables/engine.js";
import { computed } from "vue";

//#region src/utils/system.ts
const defineSystem = (name, setup) => {
	function useSystem(engine) {
		if (engine) return computed(() => engine.getSystem(name));
		else {
			const engine = useEngine();
			engine.addSystem(name, setup);
			const system = engine.getSystem(name);
			if (!system) throw new Error(`System ${String(name)} is not initialized`);
			return system;
		}
	}
	return useSystem;
};

//#endregion
export { defineSystem };