import guide_trigger_default from "./guide-trigger.uno.js";
import guide_content_default from "./guide-content.uno.js";
import guide_anchor_default from "./guide-anchor.uno.js";
import guide_default$1 from "./guide.uno.js";
//#region src/components/guide/index.ts
var guide_default = { components: {
	Guide: guide_default$1,
	GuideAnchor: guide_anchor_default,
	GuideContent: guide_content_default,
	GuideTrigger: guide_trigger_default
} };
//#endregion
export { guide_default$1 as Guide, guide_anchor_default as GuideAnchor, guide_content_default as GuideContent, guide_trigger_default as GuideTrigger, guide_default as default };
