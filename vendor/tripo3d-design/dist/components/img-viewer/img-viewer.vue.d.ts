import { Classed } from '../../type';
import { ImgSource } from './helper';
type __VLS_Props = Classed & {
    /** 图片的替代文本。不传 → 不输出 alt 属性（保持当前行为）。
     *  显式传 "" → 输出 alt=""（装饰性图片，屏幕阅读器跳过）。
     */
    alt?: string;
    /** 图片加载策略。不传 → 不输出 loading 属性（浏览器默认 eager）。
     *  传 "lazy" → 延迟加载（视口外图片不立即请求）。
     *  传 "eager" → 立即加载。
     */
    loading?: 'lazy' | 'eager';
    src: ImgSource | ImgSource[];
};
declare var __VLS_1: {};
type __VLS_Slots = {} & {
    default?: (props: typeof __VLS_1) => any;
};
declare const __VLS_base: import('vue').DefineComponent<__VLS_Props, {}, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, false, {}, any>;
declare const __VLS_export: __VLS_WithSlots<typeof __VLS_base, __VLS_Slots>;
declare const _default: typeof __VLS_export;
export default _default;
type __VLS_WithSlots<T, S> = T & {
    new (): {
        $slots: S;
    };
};
