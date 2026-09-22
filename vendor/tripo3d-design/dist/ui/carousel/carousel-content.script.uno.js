import { cn } from "../../utils/config.js";
import { useCarousel } from "./useCarousel.js";
import { createElementBlock, createElementVNode, defineComponent, mergeProps, openBlock, renderSlot, unref } from "vue";
//#region src/ui/carousel/carousel-content.vue?vue&type=script&setup=true&lang.ts
var carousel_content_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	inheritAttrs: false,
	name: "CarouselContent",
	__name: "carousel-content",
	props: { class: {} },
	setup(__props) {
		const { carouselRef, orientation } = useCarousel();
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", {
				ref: (el) => {
					carouselRef.value = el;
				},
				class: "h-full overflow-hidden"
			}, [createElementVNode("div", mergeProps({ class: unref(cn)("flex", unref(orientation) === "horizontal" ? "-ml-4" : "-mt-4 flex-col", __props.class) }, _ctx.$attrs), [renderSlot(_ctx.$slots, "default")], 16)], 512);
		};
	}
});
//#endregion
export { carousel_content_vue_vue_type_script_setup_true_lang_default as default };
