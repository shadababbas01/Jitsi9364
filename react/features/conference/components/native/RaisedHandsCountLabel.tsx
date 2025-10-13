import React from 'react';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { IconRaiseHand } from '../../../base/icons/svg';
import Label from '../../../base/label/components/native/Label';
import Raise from '../../../base/label/components/native/RaiseHandLabel';
import BaseTheme from '../../../base/ui/components/BaseTheme.native';

import styles from './styles';
import { ColorPalette } from '../../../base/styles/components/styles/ColorPalette';

const RaisedHandsCountLabel = () => {
    const raisedHandsCount = useSelector((state: IReduxState) =>
        (state['features/base/participants'].raisedHandsQueue || []).length);

    return raisedHandsCount > 0 ? (
        <Raise
            icon = { IconRaiseHand }
            iconColor = { BaseTheme.palette.uiBackground }
            style = { styles.raisedHandsCountLabel }
            text = { `${raisedHandsCount}` }
            textStyle = { styles.raisedHandsCountLabelText } />
    ) : null;
};

export default RaisedHandsCountLabel;
