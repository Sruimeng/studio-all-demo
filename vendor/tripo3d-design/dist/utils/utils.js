import { getSuffix } from "@tripo3d/utils";
//#region src/utils/utils.ts
var checkSize = (file, size = 5) => {
	const maxFileSize = size * 1024 * 1024;
	if (file.size > maxFileSize) {
		console.log(`The uploaded file size cannot exceed ${size} MB`);
		return false;
	}
	return true;
};
var checkType = (file, type) => {
	const m = {
		image: [
			"webp",
			"png",
			"jpg",
			"jpeg"
		],
		model: [
			"fbx",
			"obj",
			"stl",
			"glb"
		]
	};
	const suffix = getSuffix(file);
	if (m[type].findIndex((v) => v === suffix) > -1) return true;
	else {
		console.log("This file type is not supported.");
		return false;
	}
};
//#endregion
export { checkSize, checkType };
