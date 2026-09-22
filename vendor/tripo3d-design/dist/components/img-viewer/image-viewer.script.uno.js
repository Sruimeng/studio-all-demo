import { cn } from "../../utils/config.js";
import icon_default from "../../ui/icon/icon.uno.js";
import float_default from "../../ui/float/float.uno.js";
import { useDragResize } from "./use-drag-resize.js";
import { _useImagePreviewerInternal, imgViewer } from "./img-viewer-opener.js";
import { Fragment, computed, createBlock, createCommentVNode, createElementBlock, createElementVNode, createTextVNode, createVNode, defineComponent, nextTick, normalizeClass, normalizeStyle, onBeforeUnmount, openBlock, reactive, ref, renderList, toDisplayString, unref, useTemplateRef, watch, withCtx } from "vue";
import { useEventListener } from "@vueuse/core";
//#region src/components/img-viewer/image-viewer.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["src"];
var _hoisted_2 = { class: "flex gap-3 bottom-3 right-3 absolute" };
var _hoisted_3 = ["disabled"];
var _hoisted_4 = ["disabled"];
var _hoisted_5 = ["disabled"];
var _hoisted_6 = ["disabled"];
var _hoisted_7 = ["data-active", "onClick"];
var _hoisted_8 = ["src"];
var MIN_SCALE = .5;
var MAX_SCALE = 2;
var STEP = .25;
var DEFAULT_SCALE = 1;
var image_viewer_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "image-viewer",
	props: {
		defaultPosition: { default: "center" },
		imageSize: { default: 424 },
		open: {
			type: Boolean,
			default: false
		},
		opener: { default: "" },
		resizable: {
			type: Boolean,
			default: false
		},
		width: { default: 448 },
		class: {}
	},
	setup(__props) {
		const props = __props;
		const { setIndex, state } = _useImagePreviewerInternal();
		const { currentImage, currentIndex } = imgViewer;
		const viewportRef = useTemplateRef("viewportRef");
		const thumbnailBarRef = useTemplateRef("thumbnailBarRef");
		const scale = ref(DEFAULT_SCALE);
		const offset = reactive({
			x: 0,
			y: 0
		});
		const isPanning = ref(false);
		const dragStart = reactive({
			x: 0,
			y: 0
		});
		const dragOrigin = reactive({
			x: 0,
			y: 0
		});
		const naturalSize = ref("");
		const gutter = props.width - props.imageSize;
		const { onHandleDown: onResizeDown, size: viewportSize } = useDragResize({
			enabled: () => props.resizable,
			initial: props.imageSize,
			viewportRef
		});
		const isMultiple = computed(() => state.resolved.length > 1);
		const canZoomIn = computed(() => scale.value < MAX_SCALE);
		const canZoomOut = computed(() => scale.value > MIN_SCALE);
		const canPan = computed(() => scale.value > DEFAULT_SCALE);
		const transformStyle = computed(() => `translate(${offset.x}px, ${offset.y}px) scale(${scale.value})`);
		const floatWidth = computed(() => viewportSize.value + gutter);
		const cursorClass = computed(() => {
			if (!canPan.value) return "cursor-default";
			return isPanning.value ? "cursor-grabbing" : "cursor-grab";
		});
		const fileExtension = computed(() => {
			const src = currentImage.value;
			if (!src || src.startsWith("blob:")) return "";
			try {
				const ext = new URL(src, globalThis.location?.href ?? "http://localhost").pathname.split(".").pop()?.toLowerCase();
				return ext ? `.${ext}` : "";
			} catch {
				return "";
			}
		});
		const headerInfo = computed(() => {
			const ext = fileExtension.value || ".jpg";
			return naturalSize.value ? `${ext}/ ${naturalSize.value}` : ext;
		});
		function clampOffset(nx, ny) {
			const v = viewportRef.value;
			if (!v) return {
				x: nx,
				y: ny
			};
			const maxX = Math.max(0, (v.clientWidth * scale.value - v.clientWidth) / 2);
			const maxY = Math.max(0, (v.clientHeight * scale.value - v.clientHeight) / 2);
			return {
				x: Math.min(maxX, Math.max(-maxX, nx)),
				y: Math.min(maxY, Math.max(-maxY, ny))
			};
		}
		function setOffset(nx, ny) {
			const c = clampOffset(nx, ny);
			offset.x = c.x;
			offset.y = c.y;
		}
		function reset() {
			scale.value = DEFAULT_SCALE;
			offset.x = 0;
			offset.y = 0;
		}
		function zoomIn() {
			if (!canZoomIn.value) return;
			scale.value = Math.min(MAX_SCALE, scale.value + STEP);
		}
		function zoomOut() {
			if (!canZoomOut.value) return;
			scale.value = Math.max(MIN_SCALE, scale.value - STEP);
		}
		function onWheel(e) {
			if (!currentImage.value) return;
			e.preventDefault();
			if (e.deltaY < 0) zoomIn();
			else if (e.deltaY > 0) zoomOut();
		}
		function onPointerDown(e) {
			if (!canPan.value) return;
			isPanning.value = true;
			dragStart.x = e.clientX;
			dragStart.y = e.clientY;
			dragOrigin.x = offset.x;
			dragOrigin.y = offset.y;
		}
		function onPointerMove(e) {
			if (!isPanning.value) return;
			setOffset(dragOrigin.x + e.clientX - dragStart.x, dragOrigin.y + e.clientY - dragStart.y);
		}
		function stopPan() {
			isPanning.value = false;
		}
		useEventListener(globalThis.window, "pointermove", onPointerMove);
		useEventListener(globalThis.window, "pointerup", stopPan);
		useEventListener(globalThis.window, "pointercancel", stopPan);
		function handleImageLoad(e) {
			const img = e.target;
			if (img.naturalWidth && img.naturalHeight) naturalSize.value = `${img.naturalWidth}*${img.naturalHeight}`;
		}
		function handlePrev() {
			if (currentIndex.value > 0) setIndex(currentIndex.value - 1);
		}
		function handleNext() {
			if (currentIndex.value < state.resolved.length - 1) setIndex(currentIndex.value + 1);
		}
		watch(() => props.open, (val) => {
			if (val) {
				viewportSize.value = props.imageSize;
				reset();
			}
		});
		onBeforeUnmount(() => {
			imgViewer.close();
		});
		watch(currentIndex, () => {
			reset();
			nextTick(() => {
				const c = thumbnailBarRef.value;
				if (!c) return;
				c.querySelector("[data-active=\"true\"]")?.scrollIntoView({
					behavior: "smooth",
					block: "nearest",
					inline: "center"
				});
			});
		});
		watch(currentImage, () => {
			naturalSize.value = "";
		});
		watch(scale, () => {
			nextTick(() => setOffset(offset.x, offset.y));
		});
		watch(viewportSize, () => {
			nextTick(() => setOffset(offset.x, offset.y));
		});
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(float_default), {
				open: props.open,
				width: floatWidth.value,
				opener: props.opener,
				"default-position": props.defaultPosition,
				class: normalizeClass(unref(cn)("p-3 rounded-3 bg-gray-4 shadow-[0px_1px_10px_0px] shadow-black-40", props.class))
			}, {
				title: withCtx(() => [createTextVNode(toDisplayString(headerInfo.value), 1)]),
				default: withCtx(() => [
					createElementVNode("div", {
						ref_key: "viewportRef",
						ref: viewportRef,
						class: "cancel-drag border border-white-10 rounded-4 select-none relative overflow-hidden",
						style: normalizeStyle({
							width: `${unref(viewportSize)}px`,
							maxWidth: "100%",
							aspectRatio: "1 / 1"
						}),
						onWheel,
						onPointerdown: onPointerDown
					}, [
						unref(currentImage) ? (openBlock(), createElementBlock("img", {
							key: unref(currentImage),
							alt: "preview",
							draggable: "false",
							src: unref(currentImage),
							style: normalizeStyle({ transform: transformStyle.value }),
							class: normalizeClass(unref(cn)("size-full block origin-center object-contain", cursorClass.value, isPanning.value ? "" : "transition-transform duration-200 ease-out")),
							onLoad: handleImageLoad
						}, null, 46, _hoisted_1)) : createCommentVNode("", true),
						createElementVNode("div", _hoisted_2, [createElementVNode("button", {
							type: "button",
							disabled: !canZoomIn.value,
							class: "cancel-drag rounded-full bg-black-40 flex size-8 items-center justify-center backdrop-blur-[17.5px] hover:bg-black-60 disabled:opacity-70 disabled:cursor-not-allowed",
							onClick: zoomIn
						}, [createVNode(unref(icon_default), {
							icon: "i-tripo:search-plus",
							class: normalizeClass(unref(cn)("c-white size-4", canZoomIn.value ? "" : "opacity-40"))
						}, null, 8, ["class"])], 8, _hoisted_3), createElementVNode("button", {
							type: "button",
							disabled: !canZoomOut.value,
							class: "cancel-drag rounded-full bg-black-40 flex size-8 items-center justify-center backdrop-blur-[17.5px] hover:bg-black-60 disabled:opacity-70 disabled:cursor-not-allowed",
							onClick: zoomOut
						}, [createVNode(unref(icon_default), {
							icon: "i-tripo:search-minus",
							class: normalizeClass(unref(cn)("c-white size-4", canZoomOut.value ? "" : "opacity-40"))
						}, null, 8, ["class"])], 8, _hoisted_4)]),
						isMultiple.value ? (openBlock(), createElementBlock(Fragment, { key: 1 }, [createElementVNode("button", {
							type: "button",
							disabled: unref(currentIndex) === 0,
							class: "cancel-drag px-0.75 py-6 rounded-6 bg-black-40 left-3 top-1/2 absolute backdrop-blur-[17.5px] hover:bg-black-60 disabled:opacity-30 -translate-y-1/2",
							onClick: handlePrev
						}, [createVNode(unref(icon_default), {
							icon: "i-tripo:angle",
							class: "c-white size-4 -rotate-90"
						})], 8, _hoisted_5), createElementVNode("button", {
							type: "button",
							disabled: unref(currentIndex) === unref(state).resolved.length - 1,
							class: "cancel-drag px-0.75 py-6 rounded-6 bg-black-40 right-3 top-1/2 absolute backdrop-blur-[17.5px] hover:bg-black-60 disabled:opacity-30 -translate-y-1/2",
							onClick: handleNext
						}, [createVNode(unref(icon_default), {
							icon: "i-tripo:angle",
							class: "c-white size-4 rotate-90"
						})], 8, _hoisted_6)], 64)) : createCommentVNode("", true)
					], 36),
					isMultiple.value ? (openBlock(), createElementBlock("div", {
						key: 0,
						ref_key: "thumbnailBarRef",
						ref: thumbnailBarRef,
						class: "cancel-drag p-1 flex gap-3 w-full overflow-x-auto"
					}, [(openBlock(true), createElementBlock(Fragment, null, renderList(unref(state).resolved, (img, index) => {
						return openBlock(), createElementBlock("button", {
							key: `${img}-${index}`,
							type: "button",
							"data-active": index === unref(currentIndex),
							class: normalizeClass(unref(cn)("rounded-3 flex-shrink-0 size-16 overflow-hidden border border-solid", index === unref(currentIndex) ? "border-purple-1 bg-transparent" : "border-white-10 bg-gray-5")),
							onClick: ($event) => unref(setIndex)(index)
						}, [createElementVNode("img", {
							src: img,
							alt: "thumbnail",
							class: "rounded-2 size-full object-cover"
						}, null, 8, _hoisted_8)], 10, _hoisted_7);
					}), 128))], 512)) : createCommentVNode("", true),
					props.resizable ? (openBlock(), createElementBlock("div", {
						key: 1,
						style: { "cursor": "nwse-resize" },
						class: "cancel-drag c-gray-400 size-4 bottom-0.5 right-0.5 absolute touch-none hover:c-white",
						onPointerdown: _cache[0] || (_cache[0] = (...args) => unref(onResizeDown) && unref(onResizeDown)(...args))
					}, [..._cache[1] || (_cache[1] = [createElementVNode("svg", {
						fill: "none",
						class: "size-full",
						viewBox: "0 0 16 16"
					}, [createElementVNode("path", {
						"stroke-width": "1.5",
						stroke: "currentColor",
						"stroke-linecap": "round",
						d: "M14 7 L7 14 M14 11.5 L11.5 14"
					})], -1)])], 32)) : createCommentVNode("", true)
				]),
				_: 1
			}, 8, [
				"open",
				"width",
				"opener",
				"default-position",
				"class"
			]);
		};
	}
});
//#endregion
export { image_viewer_vue_vue_type_script_setup_true_lang_default as default };
