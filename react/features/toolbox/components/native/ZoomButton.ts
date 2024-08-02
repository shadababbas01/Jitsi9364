import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { translate } from '../../../base/i18n/functions';
import { ZoomOut } from '../../../base/icons/svg';
import { ZoomIn } from '../../../base/icons/svg';
import { MEDIA_TYPE } from '../../../base/media/constants';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { isLocalTrackMuted } from '../../../base/tracks/functions.native';
import { updateSettings } from '../../../base/settings/actions';

/**
 * The type of the React {@code Component} props of {@link ZoomButton}.
 */
interface IProps extends AbstractButtonProps {

    /**
     * Whether the current conference is in audio only mode or not.
     */
    _audioOnly: boolean;

    /**
     * Whether video is currently muted or not.
     */
    _videoMuted: boolean;

    /**
     * Current zoom type for the video.
     */
    objectfit: 'cover' | 'contain';

    /**
     * Dispatch function from redux.
     */
    dispatch: Function;
}

/**
 * An implementation of a button for toggling the zoom type.
 */
class ZoomButton extends AbstractButton<IProps> {
    
    accessibilityLabel = 'toolbar.accessibilityLabel.ZoomButton';

    constructor(props: IProps) {
        super(props);

        this._handleClick = this._handleClick.bind(this);
    }

    get icon() {
        return this.props.objectfit === 'cover' ? ZoomOut : ZoomIn;
    }

    get label() {
        return this.props.objectfit === 'cover' ? 'toolbar.ZoomOutButton' : 'toolbar.ZoomInButton';
    }

    _handleClick() {
        const { dispatch, objectfit } = this.props;

        if (objectfit === 'cover') {
            dispatch(updateSettings({ zoomtype: 'contain' }));
        } else {
            dispatch(updateSettings({ zoomtype: 'cover' }));
        }
    }
}

function _mapStateToProps(state: IReduxState) {
    const { enabled: audioOnly } = state['features/base/audio-only'];
    const tracks = state['features/base/tracks'];
    const zoomtype = state['features/base/settings'].zoomtype;

    return {
        _audioOnly: Boolean(audioOnly),
        _videoMuted: isLocalTrackMuted(tracks, MEDIA_TYPE.VIDEO),
        objectfit: zoomtype
    };
}

export default translate(connect(_mapStateToProps)(ZoomButton));
