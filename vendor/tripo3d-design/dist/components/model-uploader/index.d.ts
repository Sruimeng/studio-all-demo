import { default as ModelUploaderInput } from './model-uploader-input.vue';
import { default as ModelUploader } from './model-uploader.vue';
export { ModelUploader, ModelUploaderInput };
declare const _default: {
    components: {
        ModelUploader: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('../../type').Classed & {
                description?: string;
                icon?: string;
                required?: boolean;
                size?: number;
                title?: string;
            }> & Readonly<{
                onChange?: ((file: File) => any) | undefined;
                "onSize-error"?: ((file: File) => any) | undefined;
                "onType-error"?: ((file: File) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
                change: (file: File) => any;
                "size-error": (file: File) => any;
                "type-error": (file: File) => any;
            }, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('../../type').Classed & {
                description?: string;
                icon?: string;
                required?: boolean;
                size?: number;
                title?: string;
            }> & Readonly<{
                onChange?: ((file: File) => any) | undefined;
                "onSize-error"?: ((file: File) => any) | undefined;
                "onType-error"?: ((file: File) => any) | undefined;
            }>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('../../type').Classed & {
            description?: string;
            icon?: string;
            required?: boolean;
            size?: number;
            title?: string;
        }> & Readonly<{
            onChange?: ((file: File) => any) | undefined;
            "onSize-error"?: ((file: File) => any) | undefined;
            "onType-error"?: ((file: File) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
            change: (file: File) => any;
            "size-error": (file: File) => any;
            "type-error": (file: File) => any;
        }, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                title?: (props: {}) => any;
            } & {
                description?: (props: {}) => any;
            };
        });
        ModelUploaderInput: import('vue').DefineComponent<{
            accept?: string;
            size?: number;
        }, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
            change: (file: File) => any;
            "size-error": (msg: File) => any;
            "type-error": (msg: File) => any;
        }, string, import('vue').PublicProps, Readonly<{
            accept?: string;
            size?: number;
        }> & Readonly<{
            onChange?: ((file: File) => any) | undefined;
            "onSize-error"?: ((msg: File) => any) | undefined;
            "onType-error"?: ((msg: File) => any) | undefined;
        }>, {
            size: number;
            accept: string;
        }, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    };
};
export default _default;
