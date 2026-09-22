import avatar_image_default from "./avatar-image.uno.js";
import avatar_root_default from "./avatar-root.uno.js";
import { AvatarFallback } from "reka-ui";
//#region src/ui/avatar/index.ts
var avatar_default = { components: {
	Avatar: avatar_root_default,
	AvatarFallback,
	AvatarImage: avatar_image_default
} };
//#endregion
export { avatar_root_default as Avatar, AvatarFallback, avatar_image_default as AvatarImage, avatar_default as default };
