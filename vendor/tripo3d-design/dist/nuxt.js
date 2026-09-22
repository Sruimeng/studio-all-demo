import { utils_exports } from "./utils/index.js";
import index_component_default from "./components/index.component.js";
import index_helper_default from "./components/index.helper.js";
import index_component_default$1 from "./ui/index.component.js";
import index_helper_default$1 from "./ui/index.helper.js";
import { version } from "./packages/design/package.js";
import { addComponent, addImports, defineNuxtModule } from "@nuxt/kit";
//#region src/nuxt.ts
var nuxt_default = defineNuxtModule({
	meta: {
		compatibility: { nuxt: ">=3.16.0" },
		configKey: "design",
		name: "@tripo3d/design/nuxt",
		version
	},
	setup({ prefix = "" }, nuxt) {
		if (nuxt.options.imports?.autoImport !== false) {
			Object.keys(index_component_default).map((component) => addComponent({
				export: component,
				filePath: "@tripo3d/design",
				name: `${prefix}${component}`
			}));
			Object.keys(index_component_default$1).map((component) => addComponent({
				export: component,
				filePath: "@tripo3d/design",
				name: `${prefix}${component}`
			}));
			addImports(Object.keys(index_helper_default).map((utils) => ({
				as: `${prefix}${utils}`,
				from: "@tripo3d/design",
				name: utils
			})));
			addImports(Object.keys(index_helper_default$1).map((utils) => ({
				as: `${prefix}${utils}`,
				from: "@tripo3d/design",
				name: utils
			})));
			addImports(Object.keys(utils_exports).map((utils) => ({
				as: `${prefix}${utils}`,
				from: "@tripo3d/design",
				name: utils
			})));
		}
		if (!nuxt.options.vite.optimizeDeps) nuxt.options.vite.optimizeDeps = { exclude: ["@tripo3d/design"] };
		else if (!nuxt.options.vite.optimizeDeps.exclude) nuxt.options.vite.optimizeDeps.exclude = ["@tripo3d/design"];
		else nuxt.options.vite.optimizeDeps.exclude.push("@tripo3d/design");
		nuxt.options.css.push("@tripo3d/design/style.css");
	}
});
//#endregion
export { nuxt_default as default };
