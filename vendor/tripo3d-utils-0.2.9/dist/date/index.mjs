import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import dayjs from "dayjs";

//#region src/date/index.ts
function dayjsInit() {
	dayjs.extend(utc);
	dayjs.extend(timezone);
}
function utcToDetailed(utcTimeString) {
	return dayjs(utcTimeString).format("YYYY-MM-DD HH:mm:ss");
}
function utcToApproximate(utcTimeString) {
	return dayjs(utcTimeString).format("MM-DD HH:mm");
}

//#endregion
export { dayjsInit, utcToApproximate, utcToDetailed };
//# sourceMappingURL=index.mjs.map