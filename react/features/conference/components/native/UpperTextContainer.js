import React, { Component } from 'react';
import { View, Text ,Image} from 'react-native';
import PictureInPictureButton from '../../../mobile/picture-in-picture/components/PictureInPictureButton';
import AudioPageTranslation from '../../../../AudioPageTranslation';
import i18next from 'i18next';
import { connect } from 'react-redux';
import {
    getParticipants
} from '../../../base/participants/functions';
import styles, { SECURITY_CALL_LOGO } from './styles';

class UpperTextContainer extends Component {
    render() {
        const { isTeamsCall } = this.props;
        const upperTextContainerStyle = isTeamsCall? styles.upperTextTeamContainerStyle : styles.upperTextOneToOneContainerStyle;
        const upperText = isTeamsCall ? 'CONFERENCE CALL' : 'STARTED CALL WITH';
        const encryptedTextStyle = isTeamsCall? styles.encryptedTextTeamStyle: styles.encryptedTextOneToOneStyle;
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
        return (
            <View style  ={styles.parentViewStyle}>
                 <View style = { styles.pipButtonContainer }>
                <PictureInPictureButton styles = { styles.pipButton } />
            </View>
                <View >
                       <Text style = {upperTextContainerStyle} >{getTranslatedText(formatString(upperText))}</Text>

                </View>
                <View >
                       <Text style = {encryptedTextStyle} >{getTranslatedText('encrypted')}</Text>

                </View>
            </View>
           
        );
    }
}


function _mapStateToProps(state, ownProps) {
    const participants = getParticipants(state);
    return {
        participants
    };
}

export default connect(_mapStateToProps)(UpperTextContainer);
