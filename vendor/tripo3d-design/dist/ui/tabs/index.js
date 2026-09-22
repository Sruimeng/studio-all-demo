import tabs_content_default from "./tabs-content.uno.js";
import tabs_trigger_default from "./tabs-trigger.uno.js";
import tabs_list_default from "./tabs-list.uno.js";
import tabs_default$1 from "./tabs.uno.js";
//#region src/ui/tabs/index.ts
var tabs_default = { components: {
	Tabs: tabs_default$1,
	TabsContent: tabs_content_default,
	TabsList: tabs_list_default,
	TabsTrigger: tabs_trigger_default
} };
//#endregion
export { tabs_default$1 as Tabs, tabs_content_default as TabsContent, tabs_list_default as TabsList, tabs_trigger_default as TabsTrigger, tabs_default as default };
