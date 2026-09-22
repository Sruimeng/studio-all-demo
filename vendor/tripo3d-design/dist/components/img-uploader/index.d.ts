import { default as ImgUploaderInput } from './img-uploader-input.vue';
import { default as ImgUploader } from './img-uploader.vue';
export { ImgUploader, ImgUploaderInput };
declare const _default: {
    components: {
        ImgUploader: import('vue').DefineComponent<import('../../type').Classed & {
            description?: string;
            icon?: string;
            multiple?: boolean;
            required?: boolean;
            size?: number;
            title?: string;
        }, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
            change: (file: File[]) => any;
            "size-error": (file: File) => any;
            "type-error": (file: File) => any;
        }, string, import('vue').PublicProps, Readonly<import('../../type').Classed & {
            description?: string;
            icon?: string;
            multiple?: boolean;
            required?: boolean;
            size?: number;
            title?: string;
        }> & Readonly<{
            onChange?: ((file: File[]) => any) | undefined;
            "onSize-error"?: ((file: File) => any) | undefined;
            "onType-error"?: ((file: File) => any) | undefined;
        }>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
        ImgUploaderInput: import('vue').DefineComponent<{
            multiple?: boolean;
            size?: number;
        }, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
            change: (file: File[]) => any;
            "size-error": (msg: File) => any;
            "type-error": (msg: File) => any;
        }, string, import('vue').PublicProps, Readonly<{
            multiple?: boolean;
            size?: number;
        }> & Readonly<{
            onChange?: ((file: File[]) => any) | undefined;
            "onSize-error"?: ((msg: File) => any) | undefined;
            "onType-error"?: ((msg: File) => any) | undefined;
        }>, {
            size: number;
            multiple: boolean;
        }, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    };
};
export default _default;
