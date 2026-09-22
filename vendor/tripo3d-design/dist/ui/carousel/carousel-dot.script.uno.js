import { useCarousel } from "./useCarousel.js";
import { Fragment, createElementBlock, defineComponent, normalizeClass, openBlock, renderList, renderSlot, unref } from "vue";
//#region src/ui/carousel/carousel-dot.vue?vue&type=script&setup=true&lang.ts
var _hoisted_1 = ["data-state", "onClick"];
var carousel_dot_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	name: "CarouselDot",
	__name: "carousel-dot",
	props: { class: {} },
	setup(__props) {
		const props = __props;
		const { carouselApi, selectedIndex } = useCarousel();
		return (_ctx, _cache) => {
			return openBlock(true), createElementBlock(Fragment, null, renderList(unref(carouselApi)?.slideNodes(), (_, index) => {
				return openBlock(), createElementBlock("button", {
					key: index,
					class: normalizeClass(props.class),
					"data-state": index == unref(selectedIndex) ? "active" : "inactive",
					onClick: ($event) => unref(carouselApi)?.scrollTo(index)
				}, [renderSlot(_ctx.$slots, "default")], 10, _hoisted_1);
			}), 128);
		};
	}
});
//#endregion
export { carousel_dot_vue_vue_type_script_setup_true_lang_default as default };
