import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

//#region src/resource/aws.ts
const PART_SIZE = 10 * 1024 * 1024;
const upload = async (temporaryToken, blob) => {
	await new Upload({
		client: new S3Client({
			credentials: {
				accessKeyId: temporaryToken.sts_ak,
				secretAccessKey: temporaryToken.sts_sk,
				sessionToken: temporaryToken.session_token
			},
			endpoint: temporaryToken.useAccelerateEndpoint ? void 0 : `https://${temporaryToken.host}`,
			region: temporaryToken.region,
			useAccelerateEndpoint: temporaryToken.useAccelerateEndpoint
		}),
		params: {
			Body: blob,
			Bucket: temporaryToken.resource_bucket,
			Key: temporaryToken.resource_uri
		},
		partSize: PART_SIZE
	}).done();
	return {
		bucket: temporaryToken.resource_bucket,
		key: temporaryToken.resource_uri
	};
};
const partUpload = async (temporaryToken, blob, onProgress) => {
	const upload = new Upload({
		client: new S3Client({
			credentials: {
				accessKeyId: temporaryToken.sts_ak,
				secretAccessKey: temporaryToken.sts_sk,
				sessionToken: temporaryToken.session_token
			},
			endpoint: temporaryToken.useAccelerateEndpoint ? void 0 : `https://${temporaryToken.host}`,
			region: temporaryToken.region,
			requestChecksumCalculation: "WHEN_REQUIRED",
			responseChecksumValidation: "WHEN_REQUIRED",
			useAccelerateEndpoint: temporaryToken.useAccelerateEndpoint
		}),
		params: {
			Body: blob,
			Bucket: temporaryToken.resource_bucket,
			Key: temporaryToken.resource_uri
		},
		partSize: PART_SIZE
	});
	if (onProgress) upload.on("httpUploadProgress", (progress) => {
		if (progress.loaded && progress.total) onProgress(progress.loaded / progress.total * 100);
	});
	await upload.done();
	return {
		bucket: temporaryToken.resource_bucket,
		key: temporaryToken.resource_uri
	};
};

//#endregion
export { partUpload, upload };
//# sourceMappingURL=index.mjs.map