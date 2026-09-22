import { Classed } from '../../type';
import { FloatContext } from './utils';
export interface FloatProps extends Classed {
    defaultPosition?: 'center' | {
        x?: number;
        y?: number;
    };
    open?: boolean;
    opener?: string;
    title?: string;
    width?: number;
}
export type { FloatContext };
