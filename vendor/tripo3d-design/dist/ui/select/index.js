import select_down_button_default from "./select-down-button.uno.js";
import select_up_button_default from "./select-up-button.uno.js";
import select_content_default from "./select-content.uno.js";
import select_trigger_default from "./select-trigger.uno.js";
import select_item_default from "./select-item.uno.js";
import { SelectArrow, SelectGroup, SelectItemText, SelectLabel, SelectRoot as Select, SelectSeparator, SelectValue } from "reka-ui";
//#region src/ui/select/index.ts
var select_default = { components: {
	ScrollDownButton: select_down_button_default,
	ScrollUpButton: select_up_button_default,
	Select,
	SelectArrow,
	SelectContent: select_content_default,
	SelectGroup,
	SelectItem: select_item_default,
	SelectItemText,
	SelectLabel,
	SelectSeparator,
	SelectTrigger: select_trigger_default,
	SelectValue
} };
//#endregion
export { select_down_button_default as ScrollDownButton, select_up_button_default as ScrollUpButton, Select, SelectArrow, select_content_default as SelectContent, SelectGroup, select_item_default as SelectItem, SelectItemText, SelectLabel, SelectSeparator, select_trigger_default as SelectTrigger, SelectValue, select_default as default };
