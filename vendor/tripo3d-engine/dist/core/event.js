import { shallowReactive } from "vue";

//#region src/core/event.ts
const createEmitter = () => {
	const emitter = shallowReactive({
		clear: () => {
			Object.values(emitter.map).forEach((set) => set?.clear());
		},
		emit: (type, event) => {
			const handlers = emitter.map[type];
			if (!handlers || handlers.size === 0) return;
			handlers.forEach((handler) => handler(event));
		},
		map: {},
		off: (type, handler) => {
			const set = emitter.map[type];
			if (set) set.delete(handler);
		},
		on: (type, handler) => {
			let set = emitter.map[type];
			if (!set) {
				set = /* @__PURE__ */ new Set();
				emitter.map[type] = set;
			}
			set.add(handler);
		}
	});
	return emitter;
};

//#endregion
export { createEmitter };