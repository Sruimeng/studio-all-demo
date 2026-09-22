import { Ref } from 'vue';
export type ImgSource = string | File;
declare const provideImage: (images: Ref<string[], string[]>) => Ref<string[], string[]>;
declare const useImage: () => Ref<string[], string[]>;
export { provideImage, useImage };
