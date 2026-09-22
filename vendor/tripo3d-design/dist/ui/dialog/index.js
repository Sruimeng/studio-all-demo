import { DialogOpener, close, show, update } from "./dialog-opener.js";
import dialog_content_default from "./dialog-content.uno.js";
import dialog_overlay_default from "./dialog-overlay.uno.js";
import { useDialog } from "./utils.js";
import dialog_close_default from "./dialog-close.uno.js";
import confirm_default from "./confirm.uno.js";
import dialog_default$1 from "./dialog.uno.js";
import { DialogDescription, DialogPortal as DialogPortal$1, DialogRoot as DialogRoot$1, DialogTitle as DialogTitle$1, DialogTrigger } from "reka-ui";
//#region src/ui/dialog/index.ts
var dialog = {
	close,
	show,
	update
};
var dialog_default = {
	components: {
		Confirm: confirm_default,
		Dialog: dialog_default$1,
		DialogClose: dialog_close_default,
		DialogContent: dialog_content_default,
		DialogDescription,
		DialogOpener,
		DialogOverlay: dialog_overlay_default,
		DialogPortal: DialogPortal$1,
		DialogRoot: DialogRoot$1,
		DialogTitle: DialogTitle$1,
		DialogTrigger
	},
	helpers: {
		dialog: {
			close,
			show,
			update
		},
		useDialog
	}
};
//#endregion
export { confirm_default as Confirm, dialog_default$1 as Dialog, dialog_close_default as DialogClose, dialog_content_default as DialogContent, DialogDescription, DialogOpener, dialog_overlay_default as DialogOverlay, DialogPortal$1 as DialogPortal, DialogRoot$1 as DialogRoot, DialogTitle$1 as DialogTitle, DialogTrigger, dialog_default as default, dialog, useDialog };
