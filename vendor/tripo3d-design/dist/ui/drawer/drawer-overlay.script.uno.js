import { cn } from "../../utils/config.js";
import { createBlock, defineComponent, mergeProps, openBlock, unref } from "vue";
import { useForwardProps } from "reka-ui";
import { DrawerOverlay } from "vaul-vue";
//#region src/ui/drawer/drawer-overlay.vue?vue&type=script&setup=true&lang.ts
var drawer_overlay_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "drawer-overlay",
	props: { class: {} },
	setup(__props) {
		const props = __props;
		const forwarded = useForwardProps(props);
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(DrawerOverlay), mergeProps({ class: unref(cn)("data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out fixed inset-0 z-50 bg-black-80", props.class) }, unref(forwarded)), null, 16, ["class"]);
		};
	}
});
//#endregion
export { drawer_overlay_vue_vue_type_script_setup_true_lang_default as default };
