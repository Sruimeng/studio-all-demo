import { DrawerRoot as Drawer, DrawerClose, DrawerTrigger } from 'vaul-vue';
import { default as DrawerContent } from './drawer-content.vue';
import { default as DrawerOverlay } from './drawer-overlay.vue';
export { Drawer, DrawerClose, DrawerContent, DrawerOverlay, DrawerTrigger };
declare const _default: {
    components: {
        Drawer: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('vue').ExtractPropTypes<{
                fixed: {
                    type: import('vue').PropType<boolean>;
                    default: undefined;
                };
                direction: {
                    type: import('vue').PropType<import('vaul-vue').DrawerDirection>;
                    default: string;
                };
                defaultOpen: {
                    type: import('vue').PropType<boolean>;
                    default: undefined;
                };
                open: {
                    type: import('vue').PropType<boolean>;
                    default: undefined;
                };
                modal: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                activeSnapPoint: {
                    type: import('vue').PropType<string | number | null>;
                    default: undefined;
                };
                closeThreshold: {
                    type: import('vue').PropType<number>;
                    default: number;
                };
                shouldScaleBackground: {
                    type: import('vue').PropType<boolean>;
                    default: undefined;
                };
                setBackgroundColorOnScale: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                scrollLockTimeout: {
                    type: import('vue').PropType<number>;
                    default: number;
                };
                dismissible: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                nested: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                noBodyStyles: {
                    type: import('vue').PropType<boolean>;
                };
                handleOnly: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                preventScrollRestoration: {
                    type: import('vue').PropType<boolean>;
                };
                snapPoints: {
                    type: import('vue').PropType<(string | number)[]>;
                    default: undefined;
                };
                fadeFromIndex: {
                    type: import('vue').PropType<never>;
                    default: undefined;
                };
            }>> & Readonly<{
                onClose?: (() => any) | undefined;
                onDrag?: ((percentageDragged: number) => any) | undefined;
                onRelease?: ((open: boolean) => any) | undefined;
                "onUpdate:open"?: ((open: boolean) => any) | undefined;
                "onUpdate:activeSnapPoint"?: ((val: string | number) => any) | undefined;
                onAnimationEnd?: ((open: boolean) => any) | undefined;
            }>, {
                open: import('vue').Ref<boolean, boolean>;
            }, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                drag: (percentageDragged: number) => void;
                release: (open: boolean) => void;
                close: () => void;
                "update:open": (open: boolean) => void;
                "update:activeSnapPoint": (val: string | number) => void;
                animationEnd: (open: boolean) => void;
            }, import('vue').PublicProps, {
                direction: import('vaul-vue').DrawerDirection;
                shouldScaleBackground: boolean;
                setBackgroundColorOnScale: boolean;
                open: boolean;
                modal: boolean;
                dismissible: boolean;
                handleOnly: boolean;
                fixed: boolean;
                activeSnapPoint: string | number | null;
                snapPoints: (string | number)[];
                fadeFromIndex: never;
                nested: boolean;
                scrollLockTimeout: number;
                closeThreshold: number;
                defaultOpen: boolean;
            }, true, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('vue').ExtractPropTypes<{
                fixed: {
                    type: import('vue').PropType<boolean>;
                    default: undefined;
                };
                direction: {
                    type: import('vue').PropType<import('vaul-vue').DrawerDirection>;
                    default: string;
                };
                defaultOpen: {
                    type: import('vue').PropType<boolean>;
                    default: undefined;
                };
                open: {
                    type: import('vue').PropType<boolean>;
                    default: undefined;
                };
                modal: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                activeSnapPoint: {
                    type: import('vue').PropType<string | number | null>;
                    default: undefined;
                };
                closeThreshold: {
                    type: import('vue').PropType<number>;
                    default: number;
                };
                shouldScaleBackground: {
                    type: import('vue').PropType<boolean>;
                    default: undefined;
                };
                setBackgroundColorOnScale: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                scrollLockTimeout: {
                    type: import('vue').PropType<number>;
                    default: number;
                };
                dismissible: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                nested: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                noBodyStyles: {
                    type: import('vue').PropType<boolean>;
                };
                handleOnly: {
                    type: import('vue').PropType<boolean>;
                    default: boolean;
                };
                preventScrollRestoration: {
                    type: import('vue').PropType<boolean>;
                };
                snapPoints: {
                    type: import('vue').PropType<(string | number)[]>;
                    default: undefined;
                };
                fadeFromIndex: {
                    type: import('vue').PropType<never>;
                    default: undefined;
                };
            }>> & Readonly<{
                onClose?: (() => any) | undefined;
                onDrag?: ((percentageDragged: number) => any) | undefined;
                onRelease?: ((open: boolean) => any) | undefined;
                "onUpdate:open"?: ((open: boolean) => any) | undefined;
                "onUpdate:activeSnapPoint"?: ((val: string | number) => any) | undefined;
                onAnimationEnd?: ((open: boolean) => any) | undefined;
            }>, {
                open: import('vue').Ref<boolean, boolean>;
            }, {}, {}, {}, {
                direction: import('vaul-vue').DrawerDirection;
                shouldScaleBackground: boolean;
                setBackgroundColorOnScale: boolean;
                open: boolean;
                modal: boolean;
                dismissible: boolean;
                handleOnly: boolean;
                fixed: boolean;
                activeSnapPoint: string | number | null;
                snapPoints: (string | number)[];
                fadeFromIndex: never;
                nested: boolean;
                scrollLockTimeout: number;
                closeThreshold: number;
                defaultOpen: boolean;
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('vue').ExtractPropTypes<{
            fixed: {
                type: import('vue').PropType<boolean>;
                default: undefined;
            };
            direction: {
                type: import('vue').PropType<import('vaul-vue').DrawerDirection>;
                default: string;
            };
            defaultOpen: {
                type: import('vue').PropType<boolean>;
                default: undefined;
            };
            open: {
                type: import('vue').PropType<boolean>;
                default: undefined;
            };
            modal: {
                type: import('vue').PropType<boolean>;
                default: boolean;
            };
            activeSnapPoint: {
                type: import('vue').PropType<string | number | null>;
                default: undefined;
            };
            closeThreshold: {
                type: import('vue').PropType<number>;
                default: number;
            };
            shouldScaleBackground: {
                type: import('vue').PropType<boolean>;
                default: undefined;
            };
            setBackgroundColorOnScale: {
                type: import('vue').PropType<boolean>;
                default: boolean;
            };
            scrollLockTimeout: {
                type: import('vue').PropType<number>;
                default: number;
            };
            dismissible: {
                type: import('vue').PropType<boolean>;
                default: boolean;
            };
            nested: {
                type: import('vue').PropType<boolean>;
                default: boolean;
            };
            noBodyStyles: {
                type: import('vue').PropType<boolean>;
            };
            handleOnly: {
                type: import('vue').PropType<boolean>;
                default: boolean;
            };
            preventScrollRestoration: {
                type: import('vue').PropType<boolean>;
            };
            snapPoints: {
                type: import('vue').PropType<(string | number)[]>;
                default: undefined;
            };
            fadeFromIndex: {
                type: import('vue').PropType<never>;
                default: undefined;
            };
        }>> & Readonly<{
            onClose?: (() => any) | undefined;
            onDrag?: ((percentageDragged: number) => any) | undefined;
            onRelease?: ((open: boolean) => any) | undefined;
            "onUpdate:open"?: ((open: boolean) => any) | undefined;
            "onUpdate:activeSnapPoint"?: ((val: string | number) => any) | undefined;
            onAnimationEnd?: ((open: boolean) => any) | undefined;
        }>, {
            open: import('vue').Ref<boolean, boolean>;
        }, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            drag: (percentageDragged: number) => void;
            release: (open: boolean) => void;
            close: () => void;
            "update:open": (open: boolean) => void;
            "update:activeSnapPoint": (val: string | number) => void;
            animationEnd: (open: boolean) => void;
        }, string, {
            direction: import('vaul-vue').DrawerDirection;
            shouldScaleBackground: boolean;
            setBackgroundColorOnScale: boolean;
            open: boolean;
            modal: boolean;
            dismissible: boolean;
            handleOnly: boolean;
            fixed: boolean;
            activeSnapPoint: string | number | null;
            snapPoints: (string | number)[];
            fadeFromIndex: never;
            nested: boolean;
            scrollLockTimeout: number;
            closeThreshold: number;
            defaultOpen: boolean;
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: Readonly<{
                default: (props: {
                    open: boolean;
                }) => any;
            }> & {
                default: (props: {
                    open: boolean;
                }) => any;
            };
        });
        DrawerClose: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').DialogCloseProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').DialogCloseProps> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').DialogCloseProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        DrawerContent: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').DialogContentProps & import('../../type').Classed> & Readonly<{
                onEscapeKeyDown?: ((event: KeyboardEvent) => any) | undefined;
                onPointerDownOutside?: ((event: import('reka-ui').PointerDownOutsideEvent) => any) | undefined;
                onFocusOutside?: ((event: import('reka-ui').FocusOutsideEvent) => any) | undefined;
                onInteractOutside?: ((event: import('reka-ui').PointerDownOutsideEvent | import('reka-ui').FocusOutsideEvent) => any) | undefined;
                onOpenAutoFocus?: ((event: Event) => any) | undefined;
                onCloseAutoFocus?: ((event: Event) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                escapeKeyDown: (event: KeyboardEvent) => any;
                pointerDownOutside: (event: import('reka-ui').PointerDownOutsideEvent) => any;
                focusOutside: (event: import('reka-ui').FocusOutsideEvent) => any;
                interactOutside: (event: import('reka-ui').PointerDownOutsideEvent | import('reka-ui').FocusOutsideEvent) => any;
                openAutoFocus: (event: Event) => any;
                closeAutoFocus: (event: Event) => any;
            }, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').DialogContentProps & import('../../type').Classed> & Readonly<{
                onEscapeKeyDown?: ((event: KeyboardEvent) => any) | undefined;
                onPointerDownOutside?: ((event: import('reka-ui').PointerDownOutsideEvent) => any) | undefined;
                onFocusOutside?: ((event: import('reka-ui').FocusOutsideEvent) => any) | undefined;
                onInteractOutside?: ((event: import('reka-ui').PointerDownOutsideEvent | import('reka-ui').FocusOutsideEvent) => any) | undefined;
                onOpenAutoFocus?: ((event: Event) => any) | undefined;
                onCloseAutoFocus?: ((event: Event) => any) | undefined;
            }>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').DialogContentProps & import('../../type').Classed> & Readonly<{
            onEscapeKeyDown?: ((event: KeyboardEvent) => any) | undefined;
            onPointerDownOutside?: ((event: import('reka-ui').PointerDownOutsideEvent) => any) | undefined;
            onFocusOutside?: ((event: import('reka-ui').FocusOutsideEvent) => any) | undefined;
            onInteractOutside?: ((event: import('reka-ui').PointerDownOutsideEvent | import('reka-ui').FocusOutsideEvent) => any) | undefined;
            onOpenAutoFocus?: ((event: Event) => any) | undefined;
            onCloseAutoFocus?: ((event: Event) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            escapeKeyDown: (event: KeyboardEvent) => any;
            pointerDownOutside: (event: import('reka-ui').PointerDownOutsideEvent) => any;
            focusOutside: (event: import('reka-ui').FocusOutsideEvent) => any;
            interactOutside: (event: import('reka-ui').PointerDownOutsideEvent | import('reka-ui').FocusOutsideEvent) => any;
            openAutoFocus: (event: Event) => any;
            closeAutoFocus: (event: Event) => any;
        }, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        DrawerOverlay: import('vue').DefineComponent<import('../../type').Classed, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
        DrawerTrigger: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').DialogTriggerProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').DialogTriggerProps> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').DialogTriggerProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
    };
};
export default _default;
