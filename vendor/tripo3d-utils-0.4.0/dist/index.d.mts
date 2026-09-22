//#region src/event-bus.d.ts
type DefaultEventMap = Record<string, unknown>;
type EventHandler<T = unknown> = (payload: T) => void;
interface EventBus<TEventMap extends Record<string, unknown> = DefaultEventMap> {
  clear: () => void;
  emit: <K extends keyof TEventMap & string>(type: K, payload: TEventMap[K]) => void;
  has: <K extends keyof TEventMap & string>(type: K, handler?: EventHandler<TEventMap[K]>) => boolean;
  off: <K extends keyof TEventMap & string>(type: K, handler: EventHandler<TEventMap[K]>) => void;
  on: <K extends keyof TEventMap & string>(type: K, handler: EventHandler<TEventMap[K]>) => () => void;
  once: <K extends keyof TEventMap & string>(type: K, handler: EventHandler<TEventMap[K]>) => () => void;
}
declare const createEventBus: <TEventMap extends Record<string, unknown> = DefaultEventMap>() => EventBus<TEventMap>;
//#endregion
//#region src/storage.d.ts
type S<T> = T extends Record<string, any> ? T | null : string | null;
declare const getStorage: <T>(key: string) => S<T> | null;
declare const setStorage: (key: string, value: unknown) => void;
declare const removeStorage: (key: string) => void;
//#endregion
//#region src/utils.d.ts
declare function isMobileDevice(ua: string | null): boolean;
declare const sleep: (ms: number) => Promise<unknown>;
declare const pf: <T, U = any>() => {
  promise: Promise<T>;
  reject: (reason?: U) => void;
  resolve: (value: T | PromiseLike<T>) => void;
};
declare const jump: (url: string, blank?: boolean) => void;
declare const download: (url: string, name?: string) => void;
declare const getSuffix: (file: File | string) => string | undefined;
declare const readFileAsDataURL: (file: File) => Promise<string>;
declare const clamp: (value: number, min: number, max: number) => number;
declare const formatBytes: (bytes: number, fractionDigits?: number) => string;
//#endregion
export { DefaultEventMap, EventBus, EventHandler, clamp, createEventBus, download, formatBytes, getStorage, getSuffix, isMobileDevice, jump, pf, readFileAsDataURL, removeStorage, setStorage, sleep };
//# sourceMappingURL=index.d.mts.map