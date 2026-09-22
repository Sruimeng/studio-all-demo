import { createInjectionState } from "@vueuse/core";
//#region src/components/guide/utils.ts
var [useProvideGuideAnchor, _useGuideAnchor] = createInjectionState((anchor) => anchor);
var useGuideAnchor = () => {
	const context = _useGuideAnchor();
	if (!context) throw new Error(`useGuideAnchor must be used within a Form component`);
	return context;
};
//#endregion
export { useGuideAnchor, useProvideGuideAnchor };
