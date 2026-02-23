import React from 'react';
import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { setLiveCaptionEnabled } from '../../../base/conference/actions';
import { IconSubtitles } from '../../../base/icons/svg';
import { translate } from '../../../base/i18n/functions';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import Switch from '../../../base/ui/components/native/Switch';
import { setRequestingSubtitles } from '../../../subtitles/actions.any';

interface IProps extends AbstractButtonProps {
    _liveCaptionEnabled: boolean;
    _language: string | null;
    _requestingSubtitles: boolean;
}

class LiveCaptionToggleButton extends AbstractButton<IProps> {
    accessibilityLabel = 'Live Caption';
    icon = IconSubtitles;
    label = 'Live Caption';
    toggledLabel = 'Live Caption';

    constructor(props: IProps) {
        super(props);

        this._onSwitchChange = this._onSwitchChange.bind(this);
    }

    _handleClick() {
        const { _liveCaptionEnabled, _language, dispatch } = this.props;
        const enabled = !_liveCaptionEnabled;

        dispatch(setLiveCaptionEnabled(enabled));
        dispatch(setRequestingSubtitles(enabled, true, _language || undefined));
    }

    _isToggled() {
        return this.props._liveCaptionEnabled;
    }

    _onSwitchChange(enabled?: boolean) {
        const { _language, dispatch } = this.props;

        dispatch(setLiveCaptionEnabled(Boolean(enabled)));
        dispatch(setRequestingSubtitles(Boolean(enabled), true, _language || undefined));
    }

    _getElementAfter() {
        return (
            <Switch
                checked = { this.props._liveCaptionEnabled }
                onChange = { this._onSwitchChange }
                style = {{ marginLeft: 'auto' }} />
        );
    }
}

function _mapStateToProps(state: IReduxState) {
    return {
        _liveCaptionEnabled: Boolean(state['features/base/conference'].liveCaptionEnabled),
        _language: state['features/subtitles']._language,
        _requestingSubtitles: Boolean(state['features/subtitles']._requestingSubtitles)
    };
}

export default translate(connect(_mapStateToProps)(LiveCaptionToggleButton));
