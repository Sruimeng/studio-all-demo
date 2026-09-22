import { cn } from "../../utils/config.js";
import drawer_overlay_default from "./drawer-overlay.uno.js";
import { createBlock, createVNode, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { VisuallyHidden, useForwardPropsEmits } from "reka-ui";
import { DrawerContent, DrawerPortal, DrawerTitle } from "vaul-vue";
//#region src/ui/drawer/drawer-content.vue?vue&type=script&setup=true&lang.ts
var drawer_content_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "drawer-content",
	props: {
		forceMount: { type: Boolean },
		disableOutsidePointerEvents: { type: Boolean },
		asChild: { type: Boolean },
		as: {},
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
			return openBlock(), createBlock(unref(DrawerPortal), null, {
				default: withCtx(() => [createVNode(drawer_overlay_default), createVNode(unref(DrawerContent), mergeProps({
					"aria-describedby": void 0,
					class: unref(cn)(`fixed z-50 flex h-auto flex-col`, `data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0`, `data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0`, `data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0`, `data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0`, props.class)
				}, unref(forwarded)), {
					default: withCtx(() => [createVNode(unref(VisuallyHidden), { "as-child": "" }, {
						default: withCtx(() => [createVNode(unref(DrawerTitle))]),
						_: 1
					}), renderSlot(_ctx.$slots, "default")]),
					_: 3
				}, 16, ["class"])]),
				_: 3
			});
		};
	}
});
//#endregion
export { drawer_content_vue_vue_type_script_setup_true_lang_default as default };
