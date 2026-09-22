import { AsTag } from 'reka-ui';
import { Classed } from '../../type';
export type ButtonProps = Classed & {
    as?: AsTag;
    backgroundClass?: string;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'default' | 'border' | 'custom';
    wrapperClass?: string;
};
