//#region src/storage.ts
const getStorage = (key) => {
	const stringData = localStorage.getItem(key);
	if (!stringData) return null;
	try {
		return JSON.parse(stringData);
	} catch {
		return null;
	}
};
const setStorage = (key, value) => {
	localStorage.setItem(key, JSON.stringify(value));
};
const removeStorage = (key) => {
	localStorage.removeItem(key);
};

//#endregion
//#region src/utils.ts
function isMobileDevice(ua) {
	if (!ua) return false;
	if (/android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) return true;
	else return false;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pf = () => {
	let resolve;
	let reject;
	return {
		promise: new Promise((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		}),
		reject,
		resolve
	};
};
const jump = (url, blank = true) => {
	const a = document.createElement("a");
	a.href = url;
	if (blank) a.target = "_blank";
	a.click();
};
const download = (url, name) => {
	const a = document.createElement("a");
	a.href = url;
	if (name) a.download = name;
	a.click();
};
const getSuffix = (file) => {
	let suffix = (typeof file === "string" ? new URL(file).pathname : file.name).split(".").pop()?.toLowerCase();
	if (file instanceof File) suffix = suffix || file.type.split("/").pop();
	return suffix;
};
const readFileAsDataURL = (file) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
};

//#endregion
export { download, getStorage, getSuffix, isMobileDevice, jump, pf, readFileAsDataURL, removeStorage, setStorage, sleep };
//# sourceMappingURL=index.mjs.map