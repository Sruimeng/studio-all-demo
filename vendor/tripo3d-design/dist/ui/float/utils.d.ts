export type FloatContext = {
    close: () => void;
};
export declare const createFloatContext: (opener: string) => FloatContext;
declare const useProvideFloat: (context: FloatContext) => FloatContext;
declare const useFloat: () => FloatContext;
export { useFloat, useProvideFloat };
