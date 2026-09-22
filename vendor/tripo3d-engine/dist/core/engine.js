import { createEmitter } from "./event.js";
import { effectScope, reactive, ref, watch } from "vue";

//#region src/core/engine.ts
const MAX_HISTORY_SIZE = 20;
const createEngine = () => {
	const scope = effectScope();
	const engine = reactive({
		addAction: (action) => {
			engine.redoList.length = 0;
			engine.undoList.push(action);
			if (engine.undoList.length > MAX_HISTORY_SIZE) engine.undoList.shift();
		},
		addSystem: (name, setup) => {
			if (engine.system[name]) return;
			const system = scope.run(() => {
				const event = {
					disable: /* @__PURE__ */ new Set(),
					dispose: /* @__PURE__ */ new Set(),
					enable: /* @__PURE__ */ new Set(),
					init: /* @__PURE__ */ new Set()
				};
				const hook = {
					onDisable: (callback) => {
						event.disable.add(callback);
					},
					onDispose: (callback) => {
						event.dispose.add(callback);
					},
					onEnable: (callback) => {
						event.enable.add(callback);
					},
					onInit: (callback) => {
						event.init.add(callback);
					}
				};
				const state = { enable: ref(true) };
				const value = setup({
					...state,
					...hook
				});
				const preset = {
					__event: event,
					__hook: hook,
					...state
				};
				event.init.forEach((callback) => callback());
				watch(state.enable, () => {
					if (state.enable.value) queueMicrotask(() => {
						event.enable.forEach((callback) => callback());
					});
					else event.disable.forEach((callback) => callback());
				});
				return reactive(Object.assign(value, preset));
			});
			if (!system) throw new Error(`System ${String(name)} setup returned undefined`);
			engine.system[name] = system;
		},
		dispose: () => {
			scope.stop();
			engine.entityManager.forEach((entity) => entity.dispose());
			engine.entityManager.clear();
			engine.emitter.clear();
			engine.undoList.length = 0;
			engine.redoList.length = 0;
			Object.values(engine.system).forEach((system) => {
				system.__event.dispose.forEach((callback) => callback());
				system.__event.dispose.clear();
				system.__event.disable.clear();
				system.__event.enable.clear();
				system.__event.init.clear();
				system.value = null;
			});
			engine.system = {};
		},
		emitter: createEmitter(),
		entityManager: /* @__PURE__ */ new Set(),
		getSystem: (name) => {
			return engine.system[name];
		},
		redo: async () => {
			if (!engine.redoList.length) return;
			const action = engine.redoList.pop();
			if (!action) return;
			try {
				await action.redo();
				engine.undoList.push(action);
				if (engine.undoList.length > MAX_HISTORY_SIZE) engine.undoList.shift();
			} catch (error) {
				console.error("Redo failed:", error);
			}
		},
		redoList: [],
		removeAction: () => {
			engine.undoList.length = 0;
			engine.redoList.length = 0;
		},
		system: {},
		undo: async () => {
			if (!engine.undoList.length) return;
			const action = engine.undoList.pop();
			if (!action) return;
			try {
				await action.undo();
				engine.redoList.push(action);
				if (engine.redoList.length > MAX_HISTORY_SIZE) engine.redoList.shift();
			} catch (error) {
				console.error("Undo failed:", error);
			}
		},
		undoList: []
	});
	return engine;
};

//#endregion
export { createEngine };