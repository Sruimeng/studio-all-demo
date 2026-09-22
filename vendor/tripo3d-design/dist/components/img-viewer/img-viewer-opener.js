import { float } from "../../ui/float/index.js";
import image_viewer_default from "./image-viewer.uno.js";
import { computed, ref, shallowReactive } from "vue";
//#region src/components/img-viewer/img-viewer-opener.ts
var IMG_VIEWER_KEY = "@tripo3d/design:img-viewer";
var state = shallowReactive({
	images: [],
	index: -1,
	objectUrls: [],
	onClose: null,
	resolved: [],
	token: null
});
var isOpenRef = ref(false);
function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}
function revokeUrls() {
	for (const url of state.objectUrls) URL.revokeObjectURL(url);
	state.objectUrls = [];
}
function resolveImages(srcs) {
	const objectUrls = [];
	return {
		objectUrls,
		resolved: srcs.map((s) => {
			if (s instanceof File) {
				const url = URL.createObjectURL(s);
				objectUrls.push(url);
				return url;
			}
			return s;
		})
	};
}
function findIndex(srcs, options) {
	if (options.target !== void 0) {
		const i = srcs.indexOf(options.target);
		if (i >= 0) return i;
	}
	return clamp(options.initialIndex ?? 0, 0, Math.max(0, srcs.length - 1));
}
function closeInternal() {
	if (state.token === null) return;
	const callback = state.onClose;
	isOpenRef.value = false;
	state.token = null;
	state.images = [];
	state.resolved = [];
	state.index = -1;
	state.onClose = null;
	revokeUrls();
	float.close(IMG_VIEWER_KEY);
	callback?.();
}
function show(src, options = {}) {
	if (globalThis.window === void 0) return () => {};
	const srcs = Array.isArray(src) ? [...src] : [src];
	if (srcs.length === 0) return () => {};
	if (state.token !== null) {
		const oldCallback = state.onClose;
		revokeUrls();
		state.onClose = null;
		oldCallback?.();
	}
	const { objectUrls, resolved } = resolveImages(srcs);
	const myToken = Symbol("img-viewer");
	state.token = myToken;
	state.images = srcs;
	state.resolved = resolved;
	state.objectUrls = objectUrls;
	state.index = findIndex(srcs, options);
	state.onClose = options.onClose ?? null;
	isOpenRef.value = true;
	float.show(image_viewer_default, {
		defaultPosition: options.initialPosition ?? "center",
		resizable: options.resizable ?? false
	}, IMG_VIEWER_KEY);
	return () => {
		if (state.token !== myToken) return;
		closeInternal();
	};
}
function close() {
	if (globalThis.window === void 0) return;
	closeInternal();
}
var isOpen = computed(() => isOpenRef.value);
var currentIndex = computed(() => state.index);
var imgViewer = {
	close,
	currentImage: computed(() => state.resolved[state.index] ?? null),
	currentIndex,
	isOpen,
	show
};
function _useImagePreviewerInternal() {
	return {
		setIndex: (i) => {
			if (globalThis.window === void 0) return;
			state.index = clamp(i, 0, Math.max(0, state.resolved.length - 1));
		},
		state
	};
}
//#endregion
export { _useImagePreviewerInternal, imgViewer };
