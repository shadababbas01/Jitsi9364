import { connect } from 'react-redux';

import { openSheet } from '../../../base/dialog/actions';
import { translate } from '../../../base/i18n/functions';
import { IconBluetooth, IconVolumeOff, IconVolumeUpToolBox } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { IReduxState } from '../../../app/types';
import { AUDIO_DEVICE_BLUETOOTH, AUDIO_DEVICE_CAR, AUDIO_DEVICE_SPEAKER } from '../constants';
import { getSelectedAudioDevice } from '../functions';

import AudioRoutePickerDialog from './AudioRoutePickerDialog';

interface IProps extends AbstractButtonProps {

    /**
     * Whether the call is on a bluetooth headset or a car.
     */
    _bluetoothOn?: boolean;

    /**
     * Whether the call is on the phone's loudspeaker. Undefined while native has not said what the route is.
     */
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
        if (this.props._bluetoothOn) {
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
    // Which route is in use rather than which routes exist: the button says where the call is being heard, and a
    // bluetooth headset which is paired but not selected is not where the call is being heard. It matters most while
    // something else has moved the route on the user's behalf - a translated session taking the loudspeaker, say - when
    // a paired headset would otherwise leave the button showing a route nothing is playing on.
    const selectedDevice = getSelectedAudioDevice(state);

    return {
        _bluetoothOn: selectedDevice?.type === AUDIO_DEVICE_BLUETOOTH || selectedDevice?.type === AUDIO_DEVICE_CAR,
        _speakerOn: selectedDevice ? selectedDevice.type === AUDIO_DEVICE_SPEAKER : undefined
    };
}

export default translate(connect(_mapStateToProps)(AudioDeviceToggleButton));
