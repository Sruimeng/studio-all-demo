import { default as Autoplay } from 'embla-carousel-autoplay';
import { default as CarouselPrevious } from './carousel-previous.vue';
import { default as CarouselContent } from './carousel-content.vue';
import { default as CarouselItem } from './carousel-item.vue';
import { default as CarouselNext } from './carousel-next.vue';
import { default as CarouselDot } from './carousel-dot.vue';
import { useCarousel } from './useCarousel';
import { default as Carousel } from './carousel.vue';
export * from './type';
declare const CarouselPlugin: {
    Autoplay: typeof Autoplay;
};
export { Carousel, CarouselContent, CarouselDot, CarouselItem, CarouselNext, CarouselPlugin, CarouselPrevious, useCarousel };
declare const _default: {
    components: {
        Carousel: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('./type').CarouselProps & import('../../type').Classed> & Readonly<{
                "onInit-api"?: ((payload: unknown) => any) | undefined;
            }>, {
                canScrollNext: import('vue').Ref<boolean, boolean>;
                canScrollPrev: import('vue').Ref<boolean, boolean>;
                carouselApi: import('vue').Ref<import('embla-carousel').EmblaCarouselType | undefined, import('embla-carousel').EmblaCarouselType | undefined>;
                carouselRef: import('vue').Ref<HTMLElement | undefined, HTMLElement | undefined>;
                orientation: "horizontal" | "vertical" | undefined;
                scrollNext: () => void;
                scrollPrev: () => void;
            }, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
                "init-api": (payload: unknown) => any;
            }, import('vue').PublicProps, {
                orientation: "horizontal" | "vertical";
            }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('./type').CarouselProps & import('../../type').Classed> & Readonly<{
                "onInit-api"?: ((payload: unknown) => any) | undefined;
            }>, {
                canScrollNext: import('vue').Ref<boolean, boolean>;
                canScrollPrev: import('vue').Ref<boolean, boolean>;
                carouselApi: import('vue').Ref<import('embla-carousel').EmblaCarouselType | undefined, import('embla-carousel').EmblaCarouselType | undefined>;
                carouselRef: import('vue').Ref<HTMLElement | undefined, HTMLElement | undefined>;
                orientation: "horizontal" | "vertical" | undefined;
                scrollNext: () => void;
                scrollPrev: () => void;
            }, {}, {}, {}, {
                orientation: "horizontal" | "vertical";
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('./type').CarouselProps & import('../../type').Classed> & Readonly<{
            "onInit-api"?: ((payload: unknown) => any) | undefined;
        }>, {
            canScrollNext: import('vue').Ref<boolean, boolean>;
            canScrollPrev: import('vue').Ref<boolean, boolean>;
            carouselApi: import('vue').Ref<import('embla-carousel').EmblaCarouselType | undefined, import('embla-carousel').EmblaCarouselType | undefined>;
            carouselRef: import('vue').Ref<HTMLElement | undefined, HTMLElement | undefined>;
            orientation: "horizontal" | "vertical" | undefined;
            scrollNext: () => void;
            scrollPrev: () => void;
        }, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
            "init-api": (payload: unknown) => any;
        }, string, {
            orientation: "horizontal" | "vertical";
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {
                    orientation: "horizontal" | "vertical" | undefined;
                    scrollNext: () => void;
                    scrollPrev: () => void;
                    carouselApi: import('embla-carousel').EmblaCarouselType | undefined;
                    carouselRef: HTMLElement | undefined;
                    canScrollNext: boolean;
                    canScrollPrev: boolean;
                }) => any;
            };
        });
        CarouselContent: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        CarouselDot: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        CarouselItem: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        CarouselNext: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, true, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        CarouselPrevious: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, true, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
    };
    helpers: {
        CarouselPlugin: {
            Autoplay: typeof Autoplay;
        };
        useCarousel: typeof useCarousel;
    };
};
export default _default;
