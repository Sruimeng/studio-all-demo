import { DialogDescription, DialogPortal, DialogRoot, DialogTitle, DialogTrigger } from 'reka-ui';
import { DialogOpener } from './dialog-opener';
import { default as DialogContent } from './dialog-content.vue';
import { default as DialogOverlay } from './dialog-overlay.vue';
import { default as DialogClose } from './dialog-close.vue';
import { default as Confirm } from './confirm.vue';
import { useDialog } from './utils';
import { default as Dialog } from './dialog.vue';
export * from './type';
declare const dialog: {
    close: (key: string) => void;
    show: <T extends import('vue').Component>(dialog: T, params?: import('vue-component-type-helpers').ComponentProps<T>, key?: string) => string;
    update: <T extends import('vue').Component>(key: string, newParams?: import('vue-component-type-helpers').ComponentProps<T>) => void;
};
export { Confirm, Dialog, dialog, DialogClose, DialogContent, DialogDescription, DialogOpener, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogTrigger, useDialog, };
declare const _default: {
    components: {
        Confirm: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('./type').ConfirmProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('./type').ConfirmProps> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('./type').ConfirmProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                cancel?: () => void;
                confirm?: () => void;
                description?: () => void;
                title?: () => void;
            };
        });
        Dialog: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('./type').RootProps> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                "update:open": (value: boolean) => any;
            }, import('vue').PublicProps, {
                opener: string;
            }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('./type').RootProps> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, {
                opener: string;
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('./type').RootProps> & Readonly<{
            "onUpdate:open"?: ((value: boolean) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:open": (value: boolean) => any;
        }, string, {
            opener: string;
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        DialogClose: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').PrimitiveProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {
                as: import('reka-ui').AsTag | import('vue').Component;
            }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').PrimitiveProps> & Readonly<{}>, {}, {}, {}, {}, {
                as: import('reka-ui').AsTag | import('vue').Component;
            }>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').PrimitiveProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {
            as: import('reka-ui').AsTag | import('vue').Component;
        }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        DialogContent: {
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
        DialogDescription: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').DialogDescriptionProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').DialogDescriptionProps> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').DialogDescriptionProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        DialogOpener: import('vue').DefineComponent<{}, () => import('vue').VNode<import('vue').RendererNode, import('vue').RendererElement, {
            [key: string]: any;
        }>[], {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, true, {}, any>;
        DialogOverlay: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').DialogOverlayProps & import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').DialogOverlayProps & import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').DialogOverlayProps & import('../../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        DialogPortal: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').DialogPortalProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').DialogPortalProps> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').DialogPortalProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        DialogRoot: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').DialogRootProps> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
                "update:open": (value: boolean) => any;
            }, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').DialogRootProps> & Readonly<{
                "onUpdate:open"?: ((value: boolean) => any) | undefined;
            }>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').DialogRootProps> & Readonly<{
            "onUpdate:open"?: ((value: boolean) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:open": (value: boolean) => any;
        }, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {
                    open: boolean;
                    close: () => void;
                }) => any;
            };
        });
        DialogTitle: {
            new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').DialogTitleProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
                P: {};
                B: {};
                D: {};
                C: {};
                M: {};
                Defaults: {};
            }, Readonly<import('reka-ui').DialogTitleProps> & Readonly<{}>, {}, {}, {}, {}, {}>;
            __isFragment?: never;
            __isTeleport?: never;
            __isSuspense?: never;
        } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').DialogTitleProps> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
            $slots: {
                default?: (props: {}) => any;
            };
        });
        DialogTrigger: {
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
    helpers: {
        dialog: {
            close: (key: string) => void;
            show: <T extends import('vue').Component>(dialog: T, params?: import('vue-component-type-helpers').ComponentProps<T>, key?: string) => string;
            update: <T extends import('vue').Component>(key: string, newParams?: import('vue-component-type-helpers').ComponentProps<T>) => void;
        };
        useDialog: () => import('./utils').DialogContext;
    };
};
export default _default;
