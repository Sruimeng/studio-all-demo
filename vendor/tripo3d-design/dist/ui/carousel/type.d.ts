import { default as useEmblaCarousel, EmblaCarouselVueType } from 'embla-carousel-vue';
import { Ref, UnwrapRef } from 'vue';
export type CarouselApi = EmblaCarouselVueType[1];
export type UnwrapRefCarouselApi = UnwrapRef<CarouselApi>;
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];
export interface CarouselProps {
    opts?: CarouselOptions;
    orientation?: 'horizontal' | 'vertical';
    plugins?: CarouselPlugin;
}
export interface CarouselEmits {
    (e: 'init-api', payload: unknown): void;
}
export interface CarouselContext {
    canScrollNext: Ref<boolean>;
    canScrollPrev: Ref<boolean>;
    carouselApi: CarouselApi;
    carouselRef: Ref<HTMLElement | undefined>;
    orientation?: 'horizontal' | 'vertical';
    scrollNext: () => void;
    scrollPrev: () => void;
    selectedIndex: Ref<number>;
}
export {};
