import { cn } from "../../utils/config.js";
import { computed, createBlock, createElementBlock, createElementVNode, defineComponent, normalizeClass, openBlock, renderSlot, resolveDynamicComponent, unref, withCtx } from "vue";
//#region src/ui/button/button.vue?vue&type=script&setup=true&lang.ts
var button_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "button",
	props: {
		class: {},
		as: { default: "button" },
		backgroundClass: {},
		disabled: { type: Boolean },
		loading: { type: Boolean },
		variant: { default: "default" },
		wrapperClass: {}
	},
	setup(__props) {
		const props = __props;
		const wrapperStyle = computed(() => {
			const base = "flex gap-1 items-center justify-center relative z-1";
			if (props.disabled) return `${base} wrapper-disabled`;
			if (props.loading) return `${base} c-transparent loading-text-shimmer`;
			if (props.variant === "default") return `${base} wrapper-default`;
			if (props.variant === "border") return `${base} wrapper-border`;
			return base;
		});
		const backgroundStyle = computed(() => {
			if (props.variant === "default") return "bg-default";
			if (props.variant === "border") return "bg-border";
			return "";
		});
		return (_ctx, _cache) => {
			return openBlock(), createBlock(resolveDynamicComponent(__props.as), {
				disabled: props.disabled || props.loading,
				class: normalizeClass(unref(cn)("tripo-button group text-3.5 font-500 rounded-25 w-fit cursor-pointer box-border relative", props.class))
			}, {
				default: withCtx(() => [props.disabled ? (openBlock(), createElementBlock("div", {
					key: 0,
					class: normalizeClass(unref(cn)("background bg-disabled", props.backgroundClass))
				}, null, 2)) : props.loading ? (openBlock(), createElementBlock("div", {
					key: 1,
					class: normalizeClass(unref(cn)("background bg-loading overflow-hidden", props.backgroundClass))
				}, [..._cache[0] || (_cache[0] = [createElementVNode("div", { class: "background loading-inner-shimmer" }, null, -1)])], 2)) : (openBlock(), createElementBlock("div", {
					key: 2,
					class: normalizeClass(unref(cn)("background", backgroundStyle.value, props.backgroundClass))
				}, null, 2)), createElementVNode("div", { class: normalizeClass(unref(cn)(wrapperStyle.value, props.wrapperClass)) }, [renderSlot(_ctx.$slots, "default", {}, void 0, true)], 2)]),
				_: 3
			}, 8, ["disabled", "class"]);
		};
	}
});
//#endregion
export { button_vue_vue_type_script_setup_true_lang_default as default };
