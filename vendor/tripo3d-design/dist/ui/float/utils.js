import { close } from "./float-opener.js";
import { useAttrs } from "vue";
import { createInjectionState } from "@vueuse/core";
//#region src/ui/float/utils.ts
var createFloatContext = (opener) => {
	return { close: () => close(opener) };
};
var [useProvideFloat, _useFloat] = createInjectionState((context) => context);
var useFloat = () => {
	const attr = useAttrs();
	if (attr.opener) return createFloatContext(attr.opener);
	const context = _useFloat();
	if (!context) throw new Error(`useFloat must be used within a Float component`);
	return context;
};
//#endregion
export { createFloatContext, useFloat, useProvideFloat };
