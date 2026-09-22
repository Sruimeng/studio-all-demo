import { onMounted, ref } from "vue";
import { createInjectionState } from "@vueuse/core";
import emblaCarouselVue from "embla-carousel-vue";
//#region src/ui/carousel/useCarousel.ts
var [useProvideCarousel, useInjectCarousel] = createInjectionState(({ opts, orientation, plugins }, emits) => {
	const [emblaNode, emblaApi] = emblaCarouselVue({
		...opts,
		axis: orientation === "horizontal" ? "x" : "y"
	}, plugins);
	function scrollPrev() {
		emblaApi.value?.scrollPrev();
	}
	function scrollNext() {
		emblaApi.value?.scrollNext();
	}
	const selectedIndex = ref(0);
	const canScrollNext = ref(false);
	const canScrollPrev = ref(false);
	function onSelect(api) {
		canScrollNext.value = api?.canScrollNext() || false;
		canScrollPrev.value = api?.canScrollPrev() || false;
		selectedIndex.value = api?.selectedScrollSnap() || 0;
	}
	onMounted(() => {
		if (!emblaApi.value) return;
		emblaApi.value?.on("init", onSelect);
		emblaApi.value?.on("reInit", onSelect);
		emblaApi.value?.on("select", onSelect);
		emits("init-api", emblaApi.value);
	});
	return {
		canScrollNext,
		canScrollPrev,
		carouselApi: emblaApi,
		carouselRef: emblaNode,
		orientation,
		scrollNext,
		scrollPrev,
		selectedIndex
	};
});
function useCarousel() {
	const carouselState = useInjectCarousel();
	if (!carouselState) throw new Error("useCarousel must be used within a <Carousel />");
	return carouselState;
}
//#endregion
export { useCarousel, useProvideCarousel };
