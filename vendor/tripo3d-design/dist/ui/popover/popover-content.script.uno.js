import { cn } from "../../utils/config.js";
import { createBlock, createVNode, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { PopoverContent, PopoverPortal, useForwardPropsEmits } from "reka-ui";
//#region src/ui/popover/popover-content.vue?vue&type=script&setup=true&lang.ts
var BaseStyle = "outline-none rounded-4 bg-gray-4 shadow-[0px_1px_10px_0px] shadow-black-10 z-50";
var AnimationBaseStyle = "data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in";
var popover_content_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	inheritAttrs: false,
	__name: "popover-content",
	props: {
		forceMount: { type: Boolean },
		memoDependencies: {},
		side: {},
		sideOffset: { default: 12 },
		sideFlip: { type: Boolean },
		align: {},
		alignOffset: {},
		alignFlip: { type: Boolean },
		avoidCollisions: { type: Boolean },
		collisionBoundary: {},
		collisionPadding: {},
		arrowPadding: {},
		hideShiftedArrow: { type: Boolean },
		sticky: {},
		hideWhenDetached: { type: Boolean },
		positionStrategy: {},
		updatePositionStrategy: {},
		disableUpdateOnLayoutShift: { type: Boolean },
		prioritizePosition: { type: Boolean },
		reference: {},
		dir: {},
		asChild: { type: Boolean },
		as: {},
		disableOutsidePointerEvents: { type: Boolean },
		class: {}
	},
	emits: [
		"escapeKeyDown",
		"pointerDownOutside",
		"focusOutside",
		"interactOutside",
		"openAutoFocus",
		"closeAutoFocus"
	],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const forwarded = useForwardPropsEmits(props, __emit);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(PopoverPortal), null, {
				default: withCtx(() => [createVNode(unref(PopoverContent), mergeProps({
					...unref(forwarded),
					..._ctx.$attrs
				}, { class: unref(cn)(BaseStyle, AnimationBaseStyle, props.class) }), {
					default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
					_: 3
				}, 16, ["class"])]),
				_: 3
			});
		};
	}
});
//#endregion
export { popover_content_vue_vue_type_script_setup_true_lang_default as default };
