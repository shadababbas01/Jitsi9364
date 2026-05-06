import { connect } from 'react-redux';

import { openSheet } from '../../../base/dialog/actions';
import { translate } from '../../../base/i18n/functions';
import { IconBluetooth, IconVolumeOff, IconVolumeUpToolBox } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { IReduxState } from '../../../app/types';

import AudioRoutePickerDialog from './AudioRoutePickerDialog';

interface IProps extends AbstractButtonProps {
    _hasBluetoothDevice?: boolean;
    _speakerOn?: boolean;
}

/**
 * Implements an {@link AbstractButton} to open the audio device list.
 */
class AudioDeviceToggleButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.audioRoute';
    override icon = IconVolumeUpToolBox;
    override label = 'toolbar.accessibilityLabel.audioRoute';

    override _getIcon() {
        if (this.props._hasBluetoothDevice) {
            return IconBluetooth;
        }

        if (this.props._speakerOn === false) {
            return IconVolumeOff;
        }

        return IconVolumeUpToolBox;
    }

    /**
     * Handles clicking / pressing the button, and opens the appropriate dialog.
     *
     * @private
     * @returns {void}
     */
    override _handleClick() {
        this.props.dispatch(openSheet(AudioRoutePickerDialog));
    }
}

function _mapStateToProps(state: IReduxState) {
    const devices = state['features/mobile/audio-mode']?.devices || [];
    const selectedDevice = devices.find(d => d.selected);
    const speakerOn = selectedDevice ? selectedDevice.type === 'SPEAKER' : undefined;
    const hasBluetoothDevice = devices.some(d => d.type === 'BLUETOOTH');

    return {
        _hasBluetoothDevice: hasBluetoothDevice,
        _speakerOn: speakerOn
    };
}

export default translate(connect(_mapStateToProps)(AudioDeviceToggleButton));
