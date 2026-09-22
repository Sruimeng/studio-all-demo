import { theme } from "./preset.js";
import { defineConfig as defineConfig$1, presetIcons, presetWind4, transformerCompileClass, transformerDirectives, transformerVariantGroup } from "unocss";
import "@unocss/core";
import { pf } from "@tripo3d/utils";
import { merge } from "lodash-es";
//#region src/config.ts
var icon = {
	CDNBaseURL: "https://assets.cdn.tripo3d.com",
	promise: null
};
var init = async () => {
	if (icon.promise) return icon.promise;
	const { promise, reject, resolve } = pf();
	icon.promise = promise;
	try {
		resolve(await (await fetch(`${icon.CDNBaseURL}/fe-tripo-tools/icon.json`)).json());
	} catch (e) {
		reject(e);
	}
	return promise;
};
var defineConfig = (config) => {
	const content = { pipeline: { include: [/\.(vue|svelte|[jt]sx|uno.[jt]s|mdx?|astro|elm|php|phtml|html)($|\?)/] } };
	const mergeRules = () => {
		function resolveColor(theme, colorFamily, shade) {
			if (!colorFamily) return void 0;
			const family = theme.colors?.[colorFamily];
			if (!family) return void 0;
			if (typeof family === "string") return family;
			const value = shade ? family[shade] : family.DEFAULT;
			return typeof value === "string" ? value : void 0;
		}
		function btnVarRule(prefix, cssVar) {
			return [new RegExp(`^${prefix}-(?:(\\w+)(?:-(\\w+))?|\\[(.+)\\])$`), ([, colorFamily, shade, arbitrary], { theme }) => {
				if (arbitrary) return { [cssVar]: arbitrary };
				const color = resolveColor(theme, colorFamily, shade);
				if (color) return { [cssVar]: color };
			}];
		}
		const rules = [
			btnVarRule("btn-bg", "--btn-bg-color"),
			btnVarRule("btn-text", "--btn-text-color"),
			btnVarRule("btn-border", "--btn-border-color"),
			btnVarRule("btn-shadow", "--btn-hover-shadow-color"),
			btnVarRule("btn-glow", "--btn-glow-color"),
			btnVarRule("btn-loading-bg-from", "--btn-loading-bg-from"),
			btnVarRule("btn-loading-bg-to", "--btn-loading-bg-to"),
			btnVarRule("btn-loading-glow", "--btn-loading-glow-color"),
			btnVarRule("btn-loading-text", "--btn-loading-text-color"),
			btnVarRule("btn-loading-border-from", "--btn-loading-border-from"),
			btnVarRule("btn-loading-border-via", "--btn-loading-border-via"),
			btnVarRule("btn-loading-border-to", "--btn-loading-border-to")
		];
		if (!config?.rules) return rules;
		return [...rules, ...config.rules];
	};
	const mergePresets = () => {
		const presets = [presetWind4({ preflights: { reset: true } }), presetIcons({
			autoInstall: false,
			collections: { tripo: async () => {
				return await init();
			} }
		})];
		if (!config?.presets) return presets;
		return [...presets, ...config.presets];
	};
	const mergeTransformers = () => {
		const transformers = [
			transformerDirectives(),
			transformerVariantGroup(),
			transformerCompileClass()
		];
		if (!config?.transformers) return transformers;
		return [...transformers, ...config.transformers];
	};
	const mergedConfig = {
		...config,
		content: merge(content, config?.content),
		presets: mergePresets(),
		rules: mergeRules(),
		theme: merge(theme, config?.theme),
		transformers: mergeTransformers()
	};
	return defineConfig$1(mergedConfig);
};
//#endregion
export { defineConfig };
