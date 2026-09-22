import { cn } from "../../utils/config.js";
import { useCarousel } from "./useCarousel.js";
import { createElementBlock, defineComponent, normalizeClass, openBlock, renderSlot, unref } from "vue";
//#region src/ui/carousel/carousel-item.vue?vue&type=script&setup=true&lang.ts
var carousel_item_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	name: "CarouselItem",
	__name: "carousel-item",
	props: { class: {} },
	setup(__props) {
		const { orientation } = useCarousel();
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", {
				role: "group",
				"aria-roledescription": "slide",
				class: normalizeClass(unref(cn)("min-w-0 shrink-0 grow-0 basis-full", unref(orientation) === "horizontal" ? "pl-4" : "pt-4", __props.class))
			}, [renderSlot(_ctx.$slots, "default")], 2);
		};
	}
});
//#endregion
export { carousel_item_vue_vue_type_script_setup_true_lang_default as default };
