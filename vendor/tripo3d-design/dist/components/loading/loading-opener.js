import { dialog } from "../../ui/dialog/index.js";
import loading_default from "./loading.uno.js";
import "vue";
//#region src/components/loading/loading-opener.ts
var show = (dialog$1, params) => {
	return dialog.show(dialog$1 || loading_default, params);
};
var update = (key, newParams) => {
	dialog.update(key, newParams);
};
var close = (key) => {
	dialog.close(key);
};
//#endregion
export { close, show, update };
