import { cn } from "../../utils/config.js";
import { TOOLTIP_TOUCH_KEY } from "./context.js";
import { createBlock, createVNode, defineComponent, inject, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui";
import { reactiveOmit } from "@vueuse/core";
//#region src/ui/tooltip/tooltip-content.vue?vue&type=script&setup=true&lang.ts
var BaseStyle = "outline-none rounded-4 bg-gray-4 shadow-[0px_1px_10px_0px] shadow-black-10 z-50";
var AnimationBaseStyle = "data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in";
/** 触摸模式上下文，仅在 touchable=true 时存在 */
var tooltip_content_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	inheritAttrs: false,
	__name: "tooltip-content",
	props: {
		forceMount: { type: Boolean },
		ariaLabel: {},
		asChild: { type: Boolean },
		as: {},
		side: { default: "top" },
		sideOffset: { default: 12 },
		align: {},
		alignOffset: {},
		avoidCollisions: {
			type: Boolean,
			default: true
		},
		collisionBoundary: {},
		collisionPadding: { default: 12 },
		arrowPadding: {},
		sticky: {},
		hideWhenDetached: { type: Boolean },
		positionStrategy: {},
		updatePositionStrategy: {},
		class: {}
	},
	emits: ["escapeKeyDown", "pointerDownOutside"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const emits = __emit;
		const delegatedProps = reactiveOmit(props, "class");
		const forwarded = useForwardPropsEmits(delegatedProps, emits);
		const touchCtx = inject(TOOLTIP_TOUCH_KEY, null);
		/**
		* 处理点击 tooltip 外部区域
		* 在触摸模式下，点击外部应关闭 tooltip（类似 Popover 的行为）
		*/
		function handlePointerDownOutside() {
			if (touchCtx) touchCtx.closeByTouch();
		}
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(TooltipPortal), null, {
				default: withCtx(() => [createVNode(unref(TooltipContent), mergeProps({
					...unref(forwarded),
					..._ctx.$attrs
				}, {
					class: unref(cn)(BaseStyle, AnimationBaseStyle, props.class),
					onPointerDownOutside: handlePointerDownOutside
				}), {
					default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
					_: 3
				}, 16, ["class"])]),
				_: 3
			});
		};
	}
});
//#endregion
export { tooltip_content_vue_vue_type_script_setup_true_lang_default as default };
