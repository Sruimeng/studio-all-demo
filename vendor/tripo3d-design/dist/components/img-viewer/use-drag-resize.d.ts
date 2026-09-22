import { Ref, ShallowRef } from 'vue';
export interface UseDragResizeOptions {
    enabled: () => boolean;
    initial: number;
    viewportRef: Readonly<ShallowRef<HTMLElement | null>>;
}
export interface UseDragResizeReturn {
    isResizing: Ref<boolean>;
    onHandleDown: (e: PointerEvent) => void;
    size: Ref<number>;
}
export declare function useDragResize(options: UseDragResizeOptions): UseDragResizeReturn;
