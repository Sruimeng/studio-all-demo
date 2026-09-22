import drawer_overlay_default from "./drawer-overlay.uno.js";
import drawer_content_default from "./drawer-content.uno.js";
import { DrawerClose, DrawerRoot as Drawer, DrawerTrigger } from "vaul-vue";
//#region src/ui/drawer/index.ts
var drawer_default = { components: {
	Drawer,
	DrawerClose,
	DrawerContent: drawer_content_default,
	DrawerOverlay: drawer_overlay_default,
	DrawerTrigger
} };
//#endregion
export { Drawer, DrawerClose, drawer_content_default as DrawerContent, drawer_overlay_default as DrawerOverlay, DrawerTrigger, drawer_default as default };
