import { cn } from "../../utils/config.js";
import icon_default from "../icon/icon.uno.js";
import { close } from "./float-opener.js";
import { createFloatContext, useProvideFloat } from "./utils.js";
import { Teleport, Transition, computed, createBlock, createCommentVNode, createElementBlock, createElementVNode, createTextVNode, createVNode, defineComponent, mergeModels, nextTick, normalizeClass, normalizeStyle, openBlock, renderSlot, toDisplayString, unref, useModel, useTemplateRef, watch, withCtx } from "vue";
import { useDraggable, useEventListener } from "@vueuse/core";
//#region src/ui/float/float.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = { class: "flex gap-1 h-4 cursor-move items-center justify-between" };
var _hoisted_2 = { class: "flex flex-shrink-0 items-center" };
var _hoisted_3 = { class: "text-3 c-gray-400 leading-4 font-500 text-center flex-1" };
var float_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "float",
	props: /*@__PURE__*/ mergeModels({
		defaultPosition: { default: "center" },
		open: { type: Boolean },
		opener: { default: "" },
		title: {},
		width: { default: 448 },
		class: {}
	}, {
		"open": {
			type: Boolean,
			default: false
		},
		"openModifiers": {}
	}),
	emits: ["update:open"],
	setup(__props) {
		const props = __props;
		const open = useModel(__props, "open");
		useProvideFloat(createFloatContext(props.opener));
		const wrapperRef = useTemplateRef("wrapperRef");
		function clampWindowPosition(pos) {
			const wrapper = wrapperRef.value;
			if (!wrapper || globalThis.window === void 0) return;
			const rect = wrapper.getBoundingClientRect();
			const maxX = Math.max(0, window.innerWidth - rect.width);
			const maxY = Math.max(0, window.innerHeight - rect.height);
			pos.x = Math.max(0, Math.min(maxX, pos.x));
			pos.y = Math.max(0, Math.min(maxY, pos.y));
		}
		const { style, x, y } = useDraggable(wrapperRef, {
			onMove: (pos) => clampWindowPosition(pos),
			onStart: (_pos, e) => {
				if (e.target.closest(".cancel-drag")) return false;
			}
		});
		function clampCurrentPosition() {
			const next = {
				x: x.value,
				y: y.value
			};
			clampWindowPosition(next);
			x.value = next.x;
			y.value = next.y;
		}
		useEventListener(globalThis.window, "resize", clampCurrentPosition);
		function applyInitialPosition() {
			const wrapper = wrapperRef.value;
			if (!wrapper || globalThis.window === void 0) return;
			const rect = wrapper.getBoundingClientRect();
			const centerX = (window.innerWidth - rect.width) / 2;
			const centerY = (window.innerHeight - rect.height) / 2;
			const dp = props.defaultPosition;
			if (dp === "center") {
				x.value = centerX;
				y.value = centerY;
			} else {
				x.value = dp.x ?? centerX;
				y.value = dp.y ?? centerY;
			}
			clampCurrentPosition();
		}
		watch(open, (val) => {
			if (val) nextTick(applyInitialPosition);
		}, { immediate: true });
		const wrapperStyle = computed(() => [style.value, {
			maxWidth: "100dvw",
			width: `${props.width}px`
		}]);
		function onClose() {
			if (props.opener) close(props.opener);
			else open.value = false;
		}
		return (_ctx, _cache) => {
			return openBlock(), createBlock(Teleport, { to: "body" }, [createVNode(Transition, {
				"enter-active-class": "animate-fade-in",
				"leave-active-class": "animate-fade-out"
			}, {
				default: withCtx(() => [open.value ? (openBlock(), createElementBlock("div", {
					key: 0,
					ref_key: "wrapperRef",
					ref: wrapperRef,
					style: normalizeStyle(wrapperStyle.value),
					class: normalizeClass(unref(cn)("fixed z-50 pointer-events-auto flex flex-col gap-3 focus:outline-none", props.class))
				}, [renderSlot(_ctx.$slots, "header", {}, () => [createElementVNode("div", _hoisted_1, [
					createElementVNode("div", _hoisted_2, [createVNode(unref(icon_default), {
						class: "c-gray-400 size-4",
						icon: "i-tripo:drag-handle"
					})]),
					createElementVNode("span", _hoisted_3, [renderSlot(_ctx.$slots, "title", {}, () => [createTextVNode(toDisplayString(props.title), 1)])]),
					createElementVNode("button", {
						type: "button",
						class: "cancel-drag flex-shrink-0",
						onClick: onClose
					}, [createVNode(unref(icon_default), {
						icon: "i-tripo:close",
						class: "c-gray-400 size-4 cursor-pointer hover:c-white"
					})])
				])]), renderSlot(_ctx.$slots, "default")], 6)) : createCommentVNode("", true)]),
				_: 3
			})]);
		};
	}
});
//#endregion
export { float_vue_vue_type_script_setup_true_lang_default as default };
