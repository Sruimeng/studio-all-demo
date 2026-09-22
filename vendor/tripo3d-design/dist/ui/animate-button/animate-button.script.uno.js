import { cn } from "../../utils/config.js";
import { computed, createBlock, createElementBlock, createElementVNode, defineComponent, normalizeClass, openBlock, renderSlot, resolveDynamicComponent, shallowRef, unref, withCtx } from "vue";
//#region src/ui/animate-button/animate-button.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = {
	key: 0,
	class: "background c-gray-400 bg-white-10"
};
var _hoisted_2 = {
	key: 1,
	class: "background loading-bg overflow-hidden"
};
var animate_button_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "animate-button",
	props: {
		class: {},
		alwaysAnimate: { type: Boolean },
		as: { default: "button" },
		disabled: { type: Boolean },
		loading: { type: Boolean },
		wrapperClass: {}
	},
	setup(__props) {
		const props = __props;
		const instance = shallowRef(null);
		const handleMouseMove = (e) => {
			if (!instance.value) return;
			const rect = instance.value.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			instance.value.style.setProperty("--x", `${x}px`);
			instance.value.style.setProperty("--y", `${y}px`);
		};
		const wrapperStyle = computed(() => {
			const BaseWrapperStyle = "flex gap-1 items-center justify-center relative z-1";
			if (props.disabled) return `${BaseWrapperStyle} c-gray-500`;
			if (props.loading) return `${BaseWrapperStyle} c-transparent loading-text-shimmer`;
			return `${BaseWrapperStyle} wrapper-default`;
		});
		return (_ctx, _cache) => {
			return openBlock(), createBlock(resolveDynamicComponent(__props.as), {
				ref_key: "instance",
				ref: instance,
				disabled: props.disabled || props.loading,
				class: normalizeClass(unref(cn)("animate-button group text-3.5 font-500 rounded-25 w-fit cursor-pointer box-border relative", props.class)),
				onMousemove: handleMouseMove
			}, {
				default: withCtx(() => [props.disabled ? (openBlock(), createElementBlock("div", _hoisted_1)) : props.loading ? (openBlock(), createElementBlock("div", _hoisted_2, [..._cache[0] || (_cache[0] = [createElementVNode("div", { class: "loading-glow" }, null, -1), createElementVNode("div", { class: "background loading-border-shimmer" }, null, -1)])])) : (openBlock(), createElementBlock("div", {
					key: 2,
					class: normalizeClass(["background bg-normal", props.alwaysAnimate && "always-animate"])
				}, [..._cache[1] || (_cache[1] = [createElementVNode("div", { class: "background overflow-hidden -inset-1!" }, [createElementVNode("div", { class: "background animate-outer-glow -inset-4!" }), createElementVNode("div", { class: "background animate-inner-glow" })], -1)])], 2)), createElementVNode("div", { class: normalizeClass(unref(cn)(wrapperStyle.value, props.wrapperClass)) }, [renderSlot(_ctx.$slots, "default", {}, void 0, true)], 2)]),
				_: 3
			}, 40, ["disabled", "class"]);
		};
	}
});
//#endregion
export { animate_button_vue_vue_type_script_setup_true_lang_default as default };
