import { theme } from "../preset.js";
import { extendTailwindMerge } from "tailwind-merge";
import "unocss/preset-mini";
import clsx from "clsx";
//#region src/utils/config.ts
function flattenThemeColors(colorsObj, prefix = "") {
	const result = [];
	if (!colorsObj) return result;
	Object.entries(colorsObj).forEach(([key, value]) => {
		const currentKey = key === "DEFAULT" ? prefix : prefix ? `${prefix}-${key}` : key;
		if (typeof value === "string") result.push(currentKey);
		else if (typeof value === "object" && value !== null) {
			const nestedColors = flattenThemeColors(value, currentKey);
			result.push(...nestedColors);
		}
	});
	return result;
}
var twMerge = extendTailwindMerge({ extend: {
	classGroups: {
		"font-size": [{ text: [(arg) => !isNaN(Number(arg))] }],
		"rounded": [{ rounded: [(arg) => !isNaN(Number(arg))] }],
		"text-color": [{
			c: [(arg) => isNaN(Number(arg))],
			color: [(arg) => isNaN(Number(arg))]
		}]
	},
	theme: { color: flattenThemeColors(theme.colors) }
} });
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
export { cn };
