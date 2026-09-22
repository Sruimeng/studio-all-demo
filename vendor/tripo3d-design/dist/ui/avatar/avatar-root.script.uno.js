import { cn } from "../../utils/config.js";
import { createBlock, createPropsRestProxy, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { AvatarRoot } from "reka-ui";
//#region src/ui/avatar/avatar-root.vue?vue&type=script&setup=true&lang.ts
var avatar_root_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "avatar-root",
	props: {
		class: {},
		asChild: { type: Boolean },
		as: {}
	},
	setup(__props) {
		const other = createPropsRestProxy(__props, ["class"]);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(AvatarRoot), mergeProps({ class: unref(cn)("relative flex items-center justify-center overflow-hidden rounded-full", __props.class) }, other), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["class"]);
		};
	}
});
//#endregion
export { avatar_root_vue_vue_type_script_setup_true_lang_default as default };
