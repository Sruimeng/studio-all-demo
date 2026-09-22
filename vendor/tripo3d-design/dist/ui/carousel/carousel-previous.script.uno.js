import { useCarousel } from "./useCarousel.js";
import { createElementBlock, defineComponent, openBlock, renderSlot, unref } from "vue";
//#region src/ui/carousel/carousel-previous.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["disabled"];
var carousel_previous_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "carousel-previous",
	setup(__props) {
		const { canScrollPrev, scrollPrev } = useCarousel();
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("button", {
				disabled: !unref(canScrollPrev),
				onClick: _cache[0] || (_cache[0] = (...args) => unref(scrollPrev) && unref(scrollPrev)(...args))
			}, [renderSlot(_ctx.$slots, "default")], 8, _hoisted_1);
		};
	}
});
//#endregion
export { carousel_previous_vue_vue_type_script_setup_true_lang_default as default };
