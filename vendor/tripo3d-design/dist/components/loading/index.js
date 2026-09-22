import loading_icon_default from "./loading-icon.uno.js";
import loading_default$1 from "./loading.uno.js";
import { close, show, update } from "./loading-opener.js";
//#region src/components/loading/index.ts
var loading = {
	close,
	show,
	update
};
var loading_default = {
	components: {
		Loading: loading_default$1,
		LoadingIcon: loading_icon_default
	},
	helpers: { loading }
};
//#endregion
export { loading_default$1 as Loading, loading_icon_default as LoadingIcon, loading_default as default, loading };
