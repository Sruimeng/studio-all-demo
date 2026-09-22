/* empty css                                                                                                           */
import { computed, createBlock, defineComponent, mergeProps, openBlock, renderSlot, unref, withCtx } from "vue";
import { Toaster } from "vue-sonner";
//#region src/ui/sonner/index.vue?vue&type=script&setup=true&lang.ts
var warning = "bg-red";
var index_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "index",
	props: {
		id: {},
		invert: { type: Boolean },
		theme: {},
		position: { default: "top-center" },
		closeButtonPosition: {},
		hotkey: {},
		richColors: { type: Boolean },
		expand: { type: Boolean },
		duration: {},
		gap: {},
		visibleToasts: {},
		closeButton: { type: Boolean },
		class: {},
		style: {},
		dir: {},
		swipeDirections: {},
		icons: {},
		containerAriaLabel: {}
	},
	setup(__props) {
		const props = __props;
		const style = computed(() => {
			switch (props.position) {
				case "top-left":
				case "bottom-left": return "text-base c-foreground px-5 py-3 list-none rounded-10 bg-gray-4 flex gap-2 shadow-[0px_1px_10px_0px] shadow-black-10 items-center w-max! max-w-full";
				case "top-center":
				case "bottom-center": return "text-base c-foreground px-5 py-3 list-none rounded-10 bg-gray-4 flex gap-2 shadow-[0px_1px_10px_0px] shadow-black-10 items-center w-max! max-w-full -translate-x-1/2 left-1/2!";
				default: return "text-base c-foreground px-5 py-3 list-none rounded-10 bg-gray-4 flex gap-2 shadow-[0px_1px_10px_0px] shadow-black-10 items-center w-max! max-w-full -translate-x-1";
			}
		});
		return (_ctx, _cache) => {
			return openBlock(), createBlock(unref(Toaster), mergeProps({
				offset: 72,
				"mobile-offset": 24,
				class: "w-[calc(100dvw-144px)] cursor-pointer pointer-events-auto max-md:w-[calc(100dvw-48px)]",
				"toast-options": {
					unstyled: true,
					class: style.value,
					classes: { warning }
				}
			}, props), {
				default: withCtx(() => [renderSlot(_ctx.$slots, "default")]),
				_: 3
			}, 16, ["toast-options"]);
		};
	}
});
//#endregion
export { index_vue_vue_type_script_setup_true_lang_default as default };
