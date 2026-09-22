import { cn } from "../../utils/config.js";
import select_down_button_default from "./select-down-button.uno.js";
import select_up_button_default from "./select-up-button.uno.js";
import { createBlock, createPropsRestProxy, createVNode, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits } from "reka-ui";
//#region src/ui/select/select-content.vue?vue&type=script&setup=true&lang.ts
var AnimationInBaseStyle = "data-[state=open]:animate-fade-in";
var AnimationOutBaseStyle = "data-[state=closed]:animate-fade-out";
var select_content_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	inheritAttrs: false,
	name: "SelectContent",
	__name: "select-content",
	props: {
		forceMount: { type: Boolean },
		position: { default: "popper" },
		bodyLock: { type: Boolean },
		memoDependencies: {},
		side: {},
		sideOffset: {},
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
		"closeAutoFocus",
		"escapeKeyDown",
		"pointerDownOutside"
	],
	setup(__props, { emit: __emit }) {
		const other = createPropsRestProxy(__props, ["class", "position"]);
		const forwarded = useForwardPropsEmits(other, __emit);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(SelectPortal), null, {
				default: withCtx(() => [createVNode(unref(SelectContent), mergeProps({
					...unref(forwarded),
					..._ctx.$attrs,
					position: __props.position
				}, { class: unref(cn)(__props.position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1", "relative z-50 overflow-x-hidden overflow-y-auto rounded-3 bg-gray-4", AnimationInBaseStyle, AnimationOutBaseStyle, __props.class) }), {
					default: withCtx(() => [
						createVNode(select_up_button_default),
						createVNode(unref(SelectViewport), null, {
							default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
							_: 3
						}),
						createVNode(select_down_button_default)
					]),
					_: 3
				}, 16, ["class"])]),
				_: 3
			});
		};
	}
});
//#endregion
export { select_content_vue_vue_type_script_setup_true_lang_default as default };
