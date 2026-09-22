import { createInjectionState } from "@vueuse/core";
//#region src/components/img-viewer/helper.ts
var [provideImage, _useImage] = createInjectionState((images) => images);
var useImage = () => {
	const context = _useImage();
	if (!context) throw new Error(`useImage must be used within an ImageViewer component`);
	return context;
};
//#endregion
export { provideImage, useImage };
