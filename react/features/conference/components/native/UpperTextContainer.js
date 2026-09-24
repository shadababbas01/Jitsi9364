import React, { Component } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import PictureInPictureButton from '../../../mobile/picture-in-picture/components/PictureInPictureButton';
import AudioPageTranslation from '../../../../AudioPageTranslation';
import i18next from 'i18next';
import { connect } from 'react-redux';
import {
    getParticipantCount,
    getParticipants,
    isLocalParticipantModerator
} from '../../../base/participants/functions';
import S2SV2PanelButton from '../../../s2s-v2/components/native/S2SV2PanelButton';
import { MAX_S2S_V2_PARTICIPANTS } from '../../../s2s-v2/constants';
import { isS2SV2Active } from '../../../s2s-v2/functions';
import styles, { SECURITY_CALL_LOGO } from './styles';

import OverflowMenu from '../../../toolbox/components/native/OverflowMenu';
import { openSheet } from '../../../base/dialog/actions';
import Icon from '../../../base/icons/components/Icon';
import { more } from '../../../base/icons/svg';
import { more2 } from '../../../base/icons/svg';

class UpperTextContainer extends Component {
    _handleMorePress = () => {
        this.props.dispatch(openSheet(OverflowMenu));
    };

    render() {
        const { isTeamsCall, flag, _showS2SV2Button } = this.props;
        const upperTextContainerStyle = isTeamsCall
            ? styles.upperTextTeamContainerStyle
            : styles.upperTextOneToOneContainerStyle;
        const upperText = isTeamsCall ? 'CONFERENCE CALL' : 'STARTED CALL WITH';
        let screen = isTeamsCall ? more : more2;
        const encryptedTextStyle = isTeamsCall ? styles.encryptedTextTeamStyle : styles.encryptedTextOneToOneStyle;
        const getTranslatedText = (key) => {
            const languageCode = i18next.language || 'en';
            const translation = AudioPageTranslation[languageCode] || AudioPageTranslation.en || {};
            return translation[key] || key;
        };
        function formatString(input) {
            // Convert the string to lowercase
            let lowerCaseString = input.toLowerCase();

            // Remove all spaces from the string
            let formattedString = lowerCaseString.replace(/[\s.]+/g, '');

            return formattedString;
        }
        const upperhead =
            upperText === 'CONFERENCE CALL'
                ? getTranslatedText('conferencecall')
                : getTranslatedText('startedcallwith');

        const sideToolbarButton = {
            iconStyle: {
                color: isTeamsCall ? '#FFFFFF' : '#222220',
                fontSize: 22
            },
            style: {
                alignItems: 'center',
                backgroundColor: 'transparent',
                height: 38,
                justifyContent: 'center',
                width: 38
            },
            underlayColor: 'transparent'
        };

        return (
            <View style={styles.parentViewStyle}>
                <View style={styles.pipButtonContainer}>
                    <PictureInPictureButton styles={styles.pipButton} />
                </View>
                <View>
                    <Text style={upperTextContainerStyle}>{upperhead}</Text>
                    <Text style={encryptedTextStyle}>
                        {getTranslatedText('encrypted')}
                    </Text>
                </View>
                
                <View style={styles.headerRightActions}>
                    {_showS2SV2Button && (
                        <View style={styles.headerTranslationButtonWrapper}>
                            <S2SV2PanelButton styles={sideToolbarButton} />
                        </View>
                    )}
                    <TouchableOpacity
                        onPress={this._handleMorePress}
                        style={styles.moreButtonContainer}>
                        <Icon
                            src={screen}
                            size={24}
                            style={[
                                styles.moreIcon,
                                { color: isTeamsCall ? '#ffff' : '#000' } // black for Teams call, white otherwise
                            ]}
                        />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }
}

function _mapStateToProps(state) {
    const participants = getParticipants(state);
    const active = isS2SV2Active(state);
    const isModerator = isLocalParticipantModerator(state);
    const showS2SV2Button = getParticipantCount(state) <= MAX_S2S_V2_PARTICIPANTS
        && (active || isModerator);

    return {
        participants,
        _showS2SV2Button: showS2SV2Button
    };
}

export default connect(_mapStateToProps)(UpperTextContainer);
