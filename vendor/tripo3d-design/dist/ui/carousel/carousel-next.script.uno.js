import { useCarousel } from "./useCarousel.js";
import { createElementBlock, defineComponent, openBlock, renderSlot, unref } from "vue";
//#region src/ui/carousel/carousel-next.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["disabled"];
var carousel_next_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	name: "CarouselNext",
	__name: "carousel-next",
	setup(__props) {
		const { canScrollNext, scrollNext } = useCarousel();
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("button", {
				disabled: !unref(canScrollNext),
				onClick: _cache[0] || (_cache[0] = (...args) => unref(scrollNext) && unref(scrollNext)(...args))
			}, [renderSlot(_ctx.$slots, "default")], 8, _hoisted_1);
		};
	}
});
//#endregion
export { carousel_next_vue_vue_type_script_setup_true_lang_default as default };
