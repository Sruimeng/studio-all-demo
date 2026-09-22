import { default as ToggleGroupItem } from './toggle-group-item.vue';
import { default as ToggleGroup } from './toggle-group.vue';
import { default as Toggle } from './toggle.vue';
export * from './type';
export { Toggle, ToggleGroup, ToggleGroupItem };
declare const _default: {
    components: {
        Toggle: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').ToggleProps & import('../../type').Classed & {
                variant?: "button" | "navigation" | "icon";
            }> & Readonly<{
                "onUpdate:modelValue"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                "update:modelValue": (value: boolean) => any;
            }, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').ToggleProps & import('../../type').Classed & {
                variant?: "button" | "navigation" | "icon";
            }> & Readonly<{
                "onUpdate:modelValue"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').ToggleProps & import('../../type').Classed & {
            variant?: "button" | "navigation" | "icon";
        }> & Readonly<{
            "onUpdate:modelValue"?: ((value: boolean) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:modelValue": (value: boolean) => any;
        }, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {
                    modelValue: boolean;
                    state: "on" | "off";
                    pressed: boolean;
                    disabled: boolean;
                }) => any;
            };
        });
        ToggleGroup: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').ToggleGroupRootProps<import('reka-ui').AcceptableValue | import('reka-ui').AcceptableValue[]> & import('../../type').Classed & {
                variant?: "button" | "navigation" | "icon";
            }> & Readonly<{
                "onUpdate:modelValue"?: ((payload: import('reka-ui').AcceptableValue | import('reka-ui').AcceptableValue[]) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                "update:modelValue": (payload: import('reka-ui').AcceptableValue | import('reka-ui').AcceptableValue[]) => any;
            }, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').ToggleGroupRootProps<import('reka-ui').AcceptableValue | import('reka-ui').AcceptableValue[]> & import('../../type').Classed & {
                variant?: "button" | "navigation" | "icon";
            }> & Readonly<{
                "onUpdate:modelValue"?: ((payload: import('reka-ui').AcceptableValue | import('reka-ui').AcceptableValue[]) => any) | undefined;
            }>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').ToggleGroupRootProps<import('reka-ui').AcceptableValue | import('reka-ui').AcceptableValue[]> & import('../../type').Classed & {
            variant?: "button" | "navigation" | "icon";
        }> & Readonly<{
            "onUpdate:modelValue"?: ((payload: import('reka-ui').AcceptableValue | import('reka-ui').AcceptableValue[]) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:modelValue": (payload: import('reka-ui').AcceptableValue | import('reka-ui').AcceptableValue[]) => any;
        }, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {
                    modelValue: import('reka-ui').AcceptableValue | import('reka-ui').AcceptableValue[] | undefined;
                }) => any;
            };
        });
        ToggleGroupItem: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').ToggleGroupItemProps & import('../../type').Classed & {
                variant?: "button" | "navigation" | "icon";
            }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').ToggleGroupItemProps & import('../../type').Classed & {
                variant?: "button" | "navigation" | "icon";
            }> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').ToggleGroupItemProps & import('../../type').Classed & {
            variant?: "button" | "navigation" | "icon";
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {
                    modelValue: boolean;
                    state: "on" | "off";
                    pressed: boolean;
                    disabled: boolean;
                }) => any;
            };
        });
    };
};
export default _default;
