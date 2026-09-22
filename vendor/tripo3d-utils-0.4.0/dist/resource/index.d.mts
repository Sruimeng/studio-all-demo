//#region src/resource/aws.d.ts
interface TemporaryToken {
  host: string;
  region: string;
  resource_bucket: string;
  resource_uri: string;
  session_token: string;
  sts_ak: string;
  sts_sk: string;
  useAccelerateEndpoint: boolean;
}
declare const upload: (temporaryToken: TemporaryToken, blob: Blob) => Promise<{
  bucket: string;
  key: string;
}>;
declare const partUpload: (temporaryToken: TemporaryToken, blob: Blob, onProgress?: (progress: number) => void) => Promise<{
  bucket: string;
  key: string;
}>;
//#endregion
export { TemporaryToken, partUpload, upload };
//# sourceMappingURL=index.d.mts.map