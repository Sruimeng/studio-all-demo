export type DialogContext = {
    close: () => void;
};
export declare const createDialogContext: (opener: string) => DialogContext;
declare const useProvideDialog: (context: DialogContext) => DialogContext;
declare const useDialog: () => DialogContext;
export { useDialog, useProvideDialog };
