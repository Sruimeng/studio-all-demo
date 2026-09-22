declare const _default: {
    Loadable: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{
            load: () => any;
        } & import('../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
            P: {};
            B: {};
            D: {};
            C: {};
            M: {};
            Defaults: {};
        }, Readonly<{
            load: () => any;
        } & import('../type').Classed> & Readonly<{}>, {}, {}, {}, {}, {}>;
        __isFragment?: never;
        __isTeleport?: never;
        __isSuspense?: never;
    } & import('vue').ComponentOptionsBase<Readonly<{
        load: () => any;
    } & import('../type').Classed> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
        $slots: {
            default?: (props: {}) => any;
        };
    });
    CreditsButton: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{
            credits?: number;
            iconClass?: string;
            subscribe?: boolean;
        } & import('../type').Classed & {
            as?: import('reka-ui').AsTag;
            backgroundClass?: string;
            disabled?: boolean;
            loading?: boolean;
            variant?: "default" | "border" | "custom";
            wrapperClass?: string;
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
            P: {};
            B: {};
            D: {};
            C: {};
            M: {};
            Defaults: {};
        }, Readonly<{
            credits?: number;
            iconClass?: string;
            subscribe?: boolean;
        } & import('../type').Classed & {
            as?: import('reka-ui').AsTag;
            backgroundClass?: string;
            disabled?: boolean;
            loading?: boolean;
            variant?: "default" | "border" | "custom";
            wrapperClass?: string;
        }> & Readonly<{}>, {}, {}, {}, {}, {}>;
        __isFragment?: never;
        __isTeleport?: never;
        __isSuspense?: never;
    } & import('vue').ComponentOptionsBase<Readonly<{
        credits?: number;
        iconClass?: string;
        subscribe?: boolean;
    } & import('../type').Classed & {
        as?: import('reka-ui').AsTag;
        backgroundClass?: string;
        disabled?: boolean;
        loading?: boolean;
        variant?: "default" | "border" | "custom";
        wrapperClass?: string;
    }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
        $slots: {
            default?: (props: {}) => any;
        };
    });
    Loading: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, true, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
            P: {};
            B: {};
            D: {};
            C: {};
            M: {};
            Defaults: {};
        }, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, {}>;
        __isFragment?: never;
        __isTeleport?: never;
        __isSuspense?: never;
    } & import('vue').ComponentOptionsBase<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
        $slots: {
            default?: (props: {}) => any;
        };
    });
    LoadingIcon: import('vue').DefineComponent<{
        gap?: number;
        monochrome?: boolean;
        size?: number;
    } & import('../type').Classed, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<{
        gap?: number;
        monochrome?: boolean;
        size?: number;
    } & import('../type').Classed> & Readonly<{}>, {
        gap: number;
        size: number;
        monochrome: boolean;
    }, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    SnapInput: import('vue').DefineComponent<{
        value: string;
    }, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {} & {
        change: (value: string) => any;
    }, string, import('vue').PublicProps, Readonly<{
        value: string;
    }> & Readonly<{
        onChange?: ((value: string) => any) | undefined;
    }>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    ModelUploader: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('../type').Classed & {
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
        }, Readonly<import('../type').Classed & {
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
    } & import('vue').ComponentOptionsBase<Readonly<import('../type').Classed & {
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
    InputSlider: import('vue').DefineComponent<import('../type').Classed & import('reka-ui').SliderRootProps & {
        inputClass?: string;
        showAuto?: boolean;
        textAuto?: string;
    }, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
        "update:modelValue": (payload: number[] | undefined) => any;
        valueCommit: (payload: number[]) => any;
    }, string, import('vue').PublicProps, Readonly<import('../type').Classed & import('reka-ui').SliderRootProps & {
        inputClass?: string;
        showAuto?: boolean;
        textAuto?: string;
    }> & Readonly<{
        "onUpdate:modelValue"?: ((payload: number[] | undefined) => any) | undefined;
        onValueCommit?: ((payload: number[]) => any) | undefined;
    }>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    ImgViewer: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('../type').Classed & {
            alt?: string;
            loading?: "lazy" | "eager";
            src: import('./img-viewer/helper').ImgSource | import('./img-viewer/helper').ImgSource[];
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
            P: {};
            B: {};
            D: {};
            C: {};
            M: {};
            Defaults: {};
        }, Readonly<import('../type').Classed & {
            alt?: string;
            loading?: "lazy" | "eager";
            src: import('./img-viewer/helper').ImgSource | import('./img-viewer/helper').ImgSource[];
        }> & Readonly<{}>, {}, {}, {}, {}, {}>;
        __isFragment?: never;
        __isTeleport?: never;
        __isSuspense?: never;
    } & import('vue').ComponentOptionsBase<Readonly<import('../type').Classed & {
        alt?: string;
        loading?: "lazy" | "eager";
        src: import('./img-viewer/helper').ImgSource | import('./img-viewer/helper').ImgSource[];
    }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
        $slots: {
            default?: (props: {}) => any;
        };
    });
    ImgViewerDelete: import('vue').DefineComponent<import('../type').Classed, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<import('../type').Classed> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
    ImgUploader: import('vue').DefineComponent<import('../type').Classed & {
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
    }, string, import('vue').PublicProps, Readonly<import('../type').Classed & {
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
    AnimateCreditsButton: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{
            credits?: number;
            iconClass?: string;
            subscribe?: boolean;
        } & import('../type').Classed & {
            alwaysAnimate?: boolean;
            as?: import('reka-ui').AsTag;
            disabled?: boolean;
            loading?: boolean;
            wrapperClass?: string;
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
            P: {};
            B: {};
            D: {};
            C: {};
            M: {};
            Defaults: {};
        }, Readonly<{
            credits?: number;
            iconClass?: string;
            subscribe?: boolean;
        } & import('../type').Classed & {
            alwaysAnimate?: boolean;
            as?: import('reka-ui').AsTag;
            disabled?: boolean;
            loading?: boolean;
            wrapperClass?: string;
        }> & Readonly<{}>, {}, {}, {}, {}, {}>;
        __isFragment?: never;
        __isTeleport?: never;
        __isSuspense?: never;
    } & import('vue').ComponentOptionsBase<Readonly<{
        credits?: number;
        iconClass?: string;
        subscribe?: boolean;
    } & import('../type').Classed & {
        alwaysAnimate?: boolean;
        as?: import('reka-ui').AsTag;
        disabled?: boolean;
        loading?: boolean;
        wrapperClass?: string;
    }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
        $slots: {
            default?: (props: {}) => any;
        };
    });
    Guide: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('..').TooltipProps> & Readonly<{
            "onUpdate:open"?: ((value: boolean) => any) | undefined;
        }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
            "update:open": (value: boolean) => any;
        }, import('vue').PublicProps, {
            delayDuration: number;
            touchable: boolean;
        }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
            P: {};
            B: {};
            D: {};
            C: {};
            M: {};
            Defaults: {};
        }, Readonly<import('..').TooltipProps> & Readonly<{
            "onUpdate:open"?: ((value: boolean) => any) | undefined;
        }>, {}, {}, {}, {}, {
            delayDuration: number;
            touchable: boolean;
        }>;
        __isFragment?: never;
        __isTeleport?: never;
        __isSuspense?: never;
    } & import('vue').ComponentOptionsBase<Readonly<import('..').TooltipProps> & Readonly<{
        "onUpdate:open"?: ((value: boolean) => any) | undefined;
    }>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {
        "update:open": (value: boolean) => any;
    }, string, {
        delayDuration: number;
        touchable: boolean;
    }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
        $slots: {
            default?: (props: {}) => any;
        };
    });
    GuideAnchor: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, true, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
            P: {};
            B: {};
            D: {};
            C: {};
            M: {};
            Defaults: {};
        }, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, {}>;
        __isFragment?: never;
        __isTeleport?: never;
        __isSuspense?: never;
    } & import('vue').ComponentOptionsBase<Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
        $slots: {
            default?: (props: {}) => any;
        };
    });
    GuideContent: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<import('reka-ui').TooltipContentProps & import('../type').Classed & {
            alt?: string;
            description?: string;
            img?: string;
            title?: string;
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {
            side: "bottom" | "left" | "right" | "top";
            sideOffset: number;
            avoidCollisions: boolean;
            collisionPadding: number | Partial<Record<"bottom" | "left" | "right" | "top", number>>;
        }, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
            P: {};
            B: {};
            D: {};
            C: {};
            M: {};
            Defaults: {};
        }, Readonly<import('reka-ui').TooltipContentProps & import('../type').Classed & {
            alt?: string;
            description?: string;
            img?: string;
            title?: string;
        }> & Readonly<{}>, {}, {}, {}, {}, {
            side: "bottom" | "left" | "right" | "top";
            sideOffset: number;
            avoidCollisions: boolean;
            collisionPadding: number | Partial<Record<"bottom" | "left" | "right" | "top", number>>;
        }>;
        __isFragment?: never;
        __isTeleport?: never;
        __isSuspense?: never;
    } & import('vue').ComponentOptionsBase<Readonly<import('reka-ui').TooltipContentProps & import('../type').Classed & {
        alt?: string;
        description?: string;
        img?: string;
        title?: string;
    }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {
        side: "bottom" | "left" | "right" | "top";
        sideOffset: number;
        avoidCollisions: boolean;
        collisionPadding: number | Partial<Record<"bottom" | "left" | "right" | "top", number>>;
    }, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
        $slots: {
            default?: (props: {}) => any;
        } & {
            img?: (props: {}) => any;
        } & {
            title?: (props: {}) => any;
        } & {
            description?: (props: {}) => any;
        };
    });
    GuideTrigger: {
        new (...args: any[]): import('vue').CreateComponentPublicInstanceWithMixins<Readonly<{
            as?: (import('reka-ui').AsTag | import('vue').Component) | undefined;
            asChild?: boolean | undefined;
        }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, import('vue').PublicProps, {}, false, {}, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, {}, any, import('vue').ComponentProvideOptions, {
            P: {};
            B: {};
            D: {};
            C: {};
            M: {};
            Defaults: {};
        }, Readonly<{
            as?: (import('reka-ui').AsTag | import('vue').Component) | undefined;
            asChild?: boolean | undefined;
        }> & Readonly<{}>, {}, {}, {}, {}, {}>;
        __isFragment?: never;
        __isTeleport?: never;
        __isSuspense?: never;
    } & import('vue').ComponentOptionsBase<Readonly<{
        as?: (import('reka-ui').AsTag | import('vue').Component) | undefined;
        asChild?: boolean | undefined;
    }> & Readonly<{}>, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, {}, {}, string, {}, import('vue').GlobalComponents, import('vue').GlobalDirectives, string, import('vue').ComponentProvideOptions> & import('vue').VNodeProps & import('vue').AllowedComponentProps & import('vue').ComponentCustomProps & (new () => {
        $slots: {
            default?: (props: {}) => any;
        };
    });
};
export default _default;
