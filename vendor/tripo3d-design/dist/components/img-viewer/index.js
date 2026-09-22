import img_viewer_delete_default from "./img-viewer-delete.uno.js";
import { imgViewer } from "./img-viewer-opener.js";
import img_viewer_default$1 from "./img-viewer.uno.js";
//#region src/components/img-viewer/index.ts
var img_viewer_default = {
	components: {
		ImgViewer: img_viewer_default$1,
		ImgViewerDelete: img_viewer_delete_default
	},
	helpers: { imgViewer }
};
//#endregion
export { img_viewer_default$1 as ImgViewer, img_viewer_delete_default as ImgViewerDelete, img_viewer_default as default, imgViewer };
