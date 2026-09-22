import popover_content_default from "./popover-content.uno.js";
import popover_title_default from "./popover-title.uno.js";
import popover_root_default from "./popover-root.uno.js";
import { PopoverAnchor, PopoverArrow, PopoverClose as PopoverClose$1, PopoverPortal as PopoverPortal$1, PopoverTrigger } from "reka-ui";
//#region src/ui/popover/index.ts
var popover_default = { components: {
	Popover: popover_root_default,
	PopoverAnchor,
	PopoverArrow,
	PopoverClose: PopoverClose$1,
	PopoverContent: popover_content_default,
	PopoverPortal: PopoverPortal$1,
	PopoverTitle: popover_title_default,
	PopoverTrigger
} };
//#endregion
export { popover_root_default as Popover, PopoverAnchor, PopoverArrow, PopoverClose$1 as PopoverClose, popover_content_default as PopoverContent, PopoverPortal$1 as PopoverPortal, popover_title_default as PopoverTitle, PopoverTrigger, popover_default as default };
