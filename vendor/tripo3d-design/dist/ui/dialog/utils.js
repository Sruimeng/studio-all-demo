import { close } from "./dialog-opener.js";
import { useAttrs } from "vue";
import { createInjectionState } from "@vueuse/core";
//#region src/ui/dialog/utils.ts
var createDialogContext = (opener) => {
	return { close: () => close(opener) };
};
var [useProvideDialog, _useDialog] = createInjectionState((context) => context);
var useDialog = () => {
	const attr = useAttrs();
	if (attr.opener) return createDialogContext(attr.opener);
	const context = _useDialog();
	if (!context) throw new Error(`useDialog must be used within a Dialog component`);
	return context;
};
//#endregion
export { createDialogContext, useDialog, useProvideDialog };
