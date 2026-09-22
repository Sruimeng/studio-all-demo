import { DialogRootProps } from 'reka-ui';
import { Classed } from '../../type';
import { DialogContext } from './utils';
export type RootProps = DialogRootProps & {
    opener?: string;
};
export interface ConfirmProps extends Classed {
    cancelText?: string;
    confirmText?: string;
    description?: string;
    onCancel?: (event: DialogContext) => void;
    onConfirm?: (event: DialogContext) => void;
    title?: string;
}
