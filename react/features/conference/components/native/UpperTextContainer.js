import React, { Component } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import PictureInPictureButton from '../../../mobile/picture-in-picture/components/PictureInPictureButton';
import AudioPageTranslation from '../../../../AudioPageTranslation';
import i18next from 'i18next';
import { connect } from 'react-redux';
import {
    getParticipants
} from '../../../base/participants/functions';
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
        const { isTeamsCall, flag } = this.props;
        const upperTextContainerStyle = isTeamsCall
            ? styles.upperTextTeamContainerStyle
            : styles.upperTextOneToOneContainerStyle;
        const upperText = isTeamsCall ? 'CONFERENCE CALL' : 'STARTED CALL WITH';
        let screen = isTeamsCall ? more : more2;
        const encryptedTextStyle = isTeamsCall ? styles.encryptedTextTeamStyle : styles.encryptedTextOneToOneStyle;
        const getTranslatedText = (key) => {
            const languageCode = i18next.language || 'en';
            console.log('this is language utc --> ', AudioPageTranslation[languageCode][key] || key);
            return AudioPageTranslation[languageCode][key] || key;
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
                ? getTranslatedText('conferenceCall')
                : getTranslatedText('startedcallwith');
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

        );
    }
}


function _mapStateToProps(state) {
    const participants = getParticipants(state);
    return {
        participants
    };
}

export default connect(_mapStateToProps)(UpperTextContainer);
