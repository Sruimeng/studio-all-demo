import { useCarousel } from "./useCarousel.js";
import carousel_previous_default from "./carousel-previous.uno.js";
import carousel_content_default from "./carousel-content.uno.js";
import carousel_item_default from "./carousel-item.uno.js";
import carousel_next_default from "./carousel-next.uno.js";
import carousel_dot_default from "./carousel-dot.uno.js";
import carousel_default$1 from "./carousel.uno.js";
import Autoplay from "embla-carousel-autoplay";
//#region src/ui/carousel/index.ts
var CarouselPlugin = { Autoplay };
var carousel_default = {
	components: {
		Carousel: carousel_default$1,
		CarouselContent: carousel_content_default,
		CarouselDot: carousel_dot_default,
		CarouselItem: carousel_item_default,
		CarouselNext: carousel_next_default,
		CarouselPrevious: carousel_previous_default
	},
	helpers: {
		CarouselPlugin,
		useCarousel
	}
};
//#endregion
export { carousel_default$1 as Carousel, carousel_content_default as CarouselContent, carousel_dot_default as CarouselDot, carousel_item_default as CarouselItem, carousel_next_default as CarouselNext, CarouselPlugin, carousel_previous_default as CarouselPrevious, carousel_default as default, useCarousel };
