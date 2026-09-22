import { defineComponent, h, shallowReactive } from "vue";
//#region src/ui/float/float-opener.ts
var Data = Symbol.for("float-data");
var keyCounter = 0;
var FloatOpener = defineComponent({ setup() {
	const data = shallowReactive({});
	if (globalThis.window) globalThis.window[Data] = data;
	return () => Object.entries(data).map(([key, item]) => h(item.float, {
		...item.params,
		key
	}));
} });
var show = (float, params, key) => {
	if (globalThis.window === void 0) return "";
	if (!globalThis.window[Data]) return "";
	if (key) {
		const existing = globalThis.window[Data][key];
		globalThis.window[Data][key] = {
			float,
			params: {
				...existing?.params ?? {},
				...params,
				open: true,
				opener: key
			}
		};
		return key;
	}
	const finalKey = `${Date.now()}-${++keyCounter}`;
	globalThis.window[Data][finalKey] = {
		float,
		params: {
			...params,
			open: true,
			opener: finalKey
		}
	};
	return finalKey;
};
var update = (key, newParams) => {
	if (globalThis.window === void 0) return;
	if (!globalThis.window[Data]) return;
	if (!globalThis.window[Data][key]) return;
	const { float, params } = globalThis.window[Data][key];
	globalThis.window[Data][key] = {
		float,
		params: {
			...params,
			...newParams,
			open: true,
			opener: key
		}
	};
};
var close = (key) => {
	if (globalThis.window === void 0) return;
	if (!globalThis.window[Data]) return;
	if (!globalThis.window[Data][key]) return;
	const { float, params } = globalThis.window[Data][key];
	globalThis.window[Data][key] = {
		float,
		params: {
			...params,
			open: false,
			opener: key
		}
	};
	setTimeout(() => {
		if (!globalThis.window[Data]) return;
		delete globalThis.window[Data][key];
	}, 150);
};
//#endregion
export { FloatOpener, close, show, update };
