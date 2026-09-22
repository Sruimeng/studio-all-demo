import { AsTag } from 'reka-ui';
import { Classed } from '../../type';
export type AnimateButtonProps = Classed & {
    alwaysAnimate?: boolean;
    as?: AsTag;
    disabled?: boolean;
    loading?: boolean;
    wrapperClass?: string;
};
