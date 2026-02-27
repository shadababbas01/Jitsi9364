import React, { Component } from 'react';
import { View, Text, Image } from 'react-native';
import styles, { SECURITY_CALL_LOGO } from './styles';
class EncryptedView extends Component {
    render() {
        const {isTeamsCall} = this.props;
        const encryptedTextStyle = isTeamsCall? styles.encryptedTextTeamStyle: styles.encryptedTextOneToOneStyle;
        return (
            <View style = { styles.encryptedContainerStyle }>
                <Text style = {encryptedTextStyle }>ENCRYPTED</Text>
                <Image style = { styles.securityLogoImageStyle } source = {SECURITY_CALL_LOGO} />
            </View>
        );
    }
}

export default EncryptedView;
