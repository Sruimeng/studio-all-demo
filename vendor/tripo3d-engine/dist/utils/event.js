import { useEngine } from "../composables/engine.js";
import { computed, nextTick, onBeforeUnmount, onMounted, watchEffect } from "vue";

//#region src/utils/event.ts
const defineEvent = (name) => {
	function useEvent(...params) {
		if (params.length === 2) {
			const [type, handler] = params;
			const engine = useEngine();
			const system = computed(() => engine.system[name]);
			engine.emitter.on(type, handler);
			const { stop } = watchEffect(() => {
				if (system.value) {
					system.value.__hook.onDispose(() => {
						engine.emitter.off(type, handler);
					});
					nextTick(() => {
						stop();
					});
				}
			});
		}
		if (params.length === 3) {
			const [engine, type, handler] = params;
			onMounted(() => {
				engine.emitter.on(type, handler);
			});
			onBeforeUnmount(() => {
				engine.emitter.off(type, handler);
			});
		}
	}
	function useEmit(engine) {
		const _engine = engine || useEngine();
		function emit(type, event) {
			_engine.emitter.emit(type, event);
		}
		return emit;
	}
	return [useEvent, useEmit];
};

//#endregion
export { defineEvent };