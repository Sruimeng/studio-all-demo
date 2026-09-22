import { Classed } from '../../type';
import { CarouselProps } from './type';
type __VLS_Props = CarouselProps & Classed;
declare var __VLS_1: {
    orientation: "horizontal" | "vertical" | undefined;
    scrollNext: () => void;
    scrollPrev: () => void;
    carouselApi: import('embla-carousel').EmblaCarouselType | undefined;
    carouselRef: HTMLElement | undefined;
    canScrollNext: boolean;
    canScrollPrev: boolean;
};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_1) => any;
};
declare const __VLS_base: import('vue').DefineComponent<__VLS_Props, {
    canScrollNext: import('vue').Ref<boolean, boolean>;
    canScrollPrev: import('vue').Ref<boolean, boolean>;
    carouselApi: import('vue').Ref<import('embla-carousel').EmblaCarouselType | undefined, import('embla-carousel').EmblaCarouselType | undefined>;
    carouselRef: import('vue').Ref<HTMLElement | undefined, HTMLElement | undefined>;
    orientation: "horizontal" | "vertical" | undefined;
    scrollNext: () => void;
    scrollPrev: () => void;
}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
    "init-api": (payload: unknown) => any;
}, string, import('vue').PublicProps, Readonly<__VLS_Props> & Readonly<{
    "onInit-api"?: ((payload: unknown) => any) | undefined;
}>, {
    orientation: "horizontal" | "vertical";
}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
