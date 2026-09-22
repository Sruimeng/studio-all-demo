import { cn } from "../../utils/config.js";
import { useProvideCarousel } from "./useCarousel.js";
import { createElementBlock, defineComponent, normalizeClass, openBlock, renderSlot, unref } from "vue";
//#region src/ui/carousel/carousel.vue?vue&type=script&setup=true&lang.ts
var carousel_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	name: "Carousel",
	__name: "carousel",
	props: {
		opts: {},
		orientation: { default: "horizontal" },
		plugins: {},
		class: {}
	},
	emits: ["init-api"],
	setup(__props, { expose: __expose, emit: __emit }) {
		const props = __props;
		const { canScrollNext, canScrollPrev, carouselApi, carouselRef, orientation, scrollNext, scrollPrev } = useProvideCarousel(props, __emit);
		__expose({
			canScrollNext,
			canScrollPrev,
			carouselApi,
			carouselRef,
			orientation,
			scrollNext,
			scrollPrev
		});
		function onKeyDown(event) {
			const prevKey = props.orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
			const nextKey = props.orientation === "vertical" ? "ArrowDown" : "ArrowRight";
			if (event.key === prevKey) {
				event.preventDefault();
				scrollPrev();
				return;
			}
			if (event.key === nextKey) {
				event.preventDefault();
				scrollNext();
			}
		}
		return (_ctx, _cache) => {
			return openBlock(), createElementBlock("div", {
				tabindex: "0",
				role: "region",
				"aria-roledescription": "carousel",
				class: normalizeClass(unref(cn)("relative", props.class)),
				onKeydown: onKeyDown
			}, [renderSlot(_ctx.$slots, "default", {
				orientation: unref(orientation),
				scrollNext: unref(scrollNext),
				scrollPrev: unref(scrollPrev),
				carouselApi: unref(carouselApi),
				carouselRef: unref(carouselRef),
				canScrollNext: unref(canScrollNext),
				canScrollPrev: unref(canScrollPrev)
			})], 34);
		};
	}
});
//#endregion
export { carousel_vue_vue_type_script_setup_true_lang_default as default };
