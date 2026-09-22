import { reactive, ref } from "vue";
import { useEventListener } from "@vueuse/core";
//#region src/components/img-viewer/use-drag-resize.ts
var MIN_VIEWPORT = 240;
var MAX_VIEWPORT = 720;
var SAFE_MARGIN = 16;
function useDragResize(options) {
	const { enabled, initial, viewportRef } = options;
	const size = ref(initial);
	const isResizing = ref(false);
	const start = reactive({
		size: 0,
		x: 0,
		y: 0
	});
	function viewportMax() {
		if (globalThis.window === void 0) return MAX_VIEWPORT;
		const v = viewportRef.value;
		const wrapper = v?.offsetParent;
		if (!v || !wrapper) return MAX_VIEWPORT;
		const vr = v.getBoundingClientRect();
		const wr = wrapper.getBoundingClientRect();
		const chromeRight = wr.right - vr.right;
		const chromeBottom = wr.bottom - vr.bottom;
		const byWidth = window.innerWidth - vr.left - chromeRight - SAFE_MARGIN;
		const byHeight = window.innerHeight - vr.top - chromeBottom - SAFE_MARGIN;
		return Math.max(MIN_VIEWPORT, Math.min(MAX_VIEWPORT, byWidth, byHeight));
	}
	function onHandleDown(e) {
		e.preventDefault();
		isResizing.value = true;
		start.x = e.clientX;
		start.y = e.clientY;
		start.size = size.value;
	}
	function onMove(e) {
		if (!isResizing.value) return;
		const delta = Math.max(e.clientX - start.x, e.clientY - start.y);
		size.value = Math.min(viewportMax(), Math.max(MIN_VIEWPORT, start.size + delta));
	}
	function stop() {
		isResizing.value = false;
	}
	useEventListener(globalThis.window, "pointermove", onMove);
	useEventListener(globalThis.window, "pointerup", stop);
	useEventListener(globalThis.window, "pointercancel", stop);
	useEventListener(globalThis.window, "resize", () => {
		if (!enabled()) return;
		const max = viewportMax();
		if (size.value > max) size.value = max;
	});
	return {
		isResizing,
		onHandleDown,
		size
	};
}
//#endregion
export { useDragResize };
