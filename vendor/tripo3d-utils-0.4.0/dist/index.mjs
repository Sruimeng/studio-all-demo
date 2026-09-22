//#region src/event-bus.ts
const createEventBus = () => {
	const handlers = /* @__PURE__ */ new Map();
	const clear = () => {
		handlers.clear();
	};
	const emit = (type, payload) => {
		const scopedHandlers = handlers.get(type);
		if (!scopedHandlers) return;
		[...scopedHandlers].forEach((handler) => {
			try {
				handler(payload);
			} catch (error) {
				console.error(`[EventBus] handler for "${type}" threw:`, error);
			}
		});
	};
	const off = (type, handler) => {
		const scopedHandlers = handlers.get(type);
		if (!scopedHandlers) return;
		scopedHandlers.delete(handler);
		if (scopedHandlers.size === 0) handlers.delete(type);
	};
	const on = (type, handler) => {
		let scopedHandlers = handlers.get(type);
		if (!scopedHandlers) {
			scopedHandlers = /* @__PURE__ */ new Set();
			handlers.set(type, scopedHandlers);
		}
		scopedHandlers.add(handler);
		return () => {
			off(type, handler);
		};
	};
	const once = (type, handler) => {
		const wrapped = (payload) => {
			off(type, wrapped);
			handler(payload);
		};
		return on(type, wrapped);
	};
	const has = (type, handler) => {
		const scopedHandlers = handlers.get(type);
		if (!scopedHandlers) return false;
		if (handler === void 0) return scopedHandlers.size > 0;
		return scopedHandlers.has(handler);
	};
	return {
		clear,
		emit,
		has,
		off,
		on,
		once
	};
};

//#endregion
//#region src/storage.ts
const getStorage = (key) => {
	const stringData = localStorage.getItem(key);
	if (!stringData) return null;
	try {
		return JSON.parse(stringData);
	} catch {
		return null;
	}
};
const setStorage = (key, value) => {
	localStorage.setItem(key, JSON.stringify(value));
};
const removeStorage = (key) => {
	localStorage.removeItem(key);
};

//#endregion
//#region src/utils.ts
function isMobileDevice(ua) {
	if (!ua) return false;
	if (/android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) return true;
	else return false;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pf = () => {
	let resolve;
	let reject;
	return {
		promise: new Promise((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		}),
		reject,
		resolve
	};
};
const jump = (url, blank = true) => {
	const a = document.createElement("a");
	a.href = url;
	if (blank) a.target = "_blank";
	a.click();
};
const download = (url, name) => {
	const a = document.createElement("a");
	a.href = url;
	if (name) a.download = name;
	a.click();
};
const getSuffix = (file) => {
	let suffix = (typeof file === "string" ? new URL(file).pathname : file.name).split(".").pop()?.toLowerCase();
	if (file instanceof File) suffix = suffix || file.type.split("/").pop();
	return suffix;
};
const readFileAsDataURL = (file) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
};
const clamp = (value, min, max) => {
	if (Number.isNaN(value)) return min;
	return Math.max(min, Math.min(max, value));
};
const formatBytes = (bytes, fractionDigits = 2) => {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = [
		"B",
		"KB",
		"MB",
		"GB",
		"TB"
	];
	let i = 0;
	let value = bytes;
	while (value >= 1024 && i < units.length - 1) {
		value /= 1024;
		i++;
	}
	return `${value.toFixed(fractionDigits)} ${units[i]}`;
};

//#endregion
export { clamp, createEventBus, download, formatBytes, getStorage, getSuffix, isMobileDevice, jump, pf, readFileAsDataURL, removeStorage, setStorage, sleep };
//# sourceMappingURL=index.mjs.map