import { defineComponent, h, shallowReactive } from "vue";
//#region src/ui/dialog/dialog-opener.ts
var Data = Symbol.for("data");
var keyCounter = 0;
var DialogOpener = defineComponent({ setup() {
	const data = shallowReactive({});
	if (globalThis.window) globalThis.window[Data] = data;
	return () => Object.entries(data).map(([key, item]) => h(item.dialog, {
		...item.params,
		key
	}));
} });
var show = (dialog, params, key) => {
	if (globalThis.window === void 0) return "";
	if (!globalThis.window[Data]) return "";
	if (key) {
		const existing = globalThis.window[Data][key];
		globalThis.window[Data][key] = {
			dialog,
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
		dialog,
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
	const { dialog, params } = globalThis.window[Data][key];
	globalThis.window[Data][key] = {
		dialog,
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
	const { dialog, params } = globalThis.window[Data][key];
	globalThis.window[Data][key] = {
		dialog,
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
export { DialogOpener, close, show, update };
