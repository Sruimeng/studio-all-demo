import { FloatOpener, close, show, update } from "./float-opener.js";
import { useFloat } from "./utils.js";
import float_default$1 from "./float.uno.js";
//#region src/ui/float/index.ts
var float = {
	close,
	show,
	update
};
var float_default = {
	components: {
		Float: float_default$1,
		FloatOpener
	},
	helpers: {
		float: {
			close,
			show,
			update
		},
		useFloat
	}
};
//#endregion
export { float_default$1 as Float, FloatOpener, float_default as default, float, useFloat };
