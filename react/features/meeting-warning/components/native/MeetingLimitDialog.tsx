import React from 'react';
import { Image, ImageStyle } from 'react-native';
import Dialog from 'react-native-dialog';
import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { hideDialog } from '../../../base/dialog/actions';
import AbstractDialog, { IProps as AbstractDialogProps } from '../../../base/dialog/components/native/AbstractDialog';
import { openURLInBrowser } from '../../../base/util/openURLInBrowser.native';
import { resolveUpgradePlansUrl } from '../../functions';

const callLimitImage = require('../../../../../images/callLimitImage.png');
const imageStyle: ImageStyle = {
    alignSelf: 'center',
    borderRadius: 12,
    height: 158,
    marginBottom: 16,
    resizeMode: 'contain',
    width: '100%'
};

interface IProps extends AbstractDialogProps {
    message: string;
    title: string;
    upgradePlansUrl?: string;
}

class MeetingLimitDialog extends AbstractDialog<IProps> {
    _onUpgrade = () => {
        const { upgradePlansUrl } = this.props;

        if (upgradePlansUrl) {
            openURLInBrowser(upgradePlansUrl, true);
        }

        this.props.dispatch(hideDialog());
    };

    override render() {
        const { message, title, upgradePlansUrl } = this.props;

        return (
            <Dialog.Container
                coverScreen = { false }
                visible = { true }>
                <Image
                    source = { callLimitImage }
                    style = { imageStyle } />
                <Dialog.Title>
                    { title }
                </Dialog.Title>
                <Dialog.Description>
                    { message }
                </Dialog.Description>
                <Dialog.Button
                    label = 'Remind me later'
                    onPress = { this._onCancel } />
                {
                    Boolean(upgradePlansUrl) && <Dialog.Button
                        label = 'Upgrade'
                        onPress = { this._onUpgrade } />
                }
            </Dialog.Container>
        );
    }
}

function _mapStateToProps(state: IReduxState) {
    return {
        upgradePlansUrl: resolveUpgradePlansUrl(state['features/base/config']?.upgradePlansUrl)
    };
}

export default connect(_mapStateToProps)(MeetingLimitDialog);
