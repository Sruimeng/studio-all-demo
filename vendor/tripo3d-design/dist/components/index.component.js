import animate_credits_button_default from "./animate-credits-button/index.js";
import credits_button_default from "./credits-button/index.js";
import guide_default from "./guide/index.js";
import img_uploader_default from "./img-uploader/index.js";
import img_viewer_default from "./img-viewer/index.js";
import snap_input_default from "./snap-input/index.js";
import input_slider_default from "./input-slider/index.js";
import loading_default from "./loading/index.js";
import loadable_default from "./loadable/index.js";
import model_uploader_default from "./model-uploader/index.js";
//#region src/components/index.component.ts
var index_component_default = {
	...guide_default.components,
	...animate_credits_button_default.components,
	...img_uploader_default.components,
	...img_viewer_default.components,
	...input_slider_default.components,
	...model_uploader_default.components,
	...snap_input_default.components,
	...loading_default.components,
	...credits_button_default.components,
	...loadable_default.components
};
//#endregion
export { index_component_default as default };
