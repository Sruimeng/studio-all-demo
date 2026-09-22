import img_viewer_default from "./img-viewer/index.js";
import loading_default from "./loading/index.js";
//#region src/components/index.helper.ts
var index_helper_default = {
	...img_viewer_default.helpers,
	...loading_default.helpers
};
//#endregion
export { index_helper_default as default };
