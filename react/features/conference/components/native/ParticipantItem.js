import React, { Component } from 'react';
import { View, Image, Text } from 'react-native';
import styles, { CROSS_ICON } from './styles';

class ParticipantItem extends Component {
    render() {
        const { participant, isTeamsCall } = this.props;
        const { name, callerAvatarURL } = participant;
        return (
            <View style = {isTeamsCall ? styles.participantTeamsItemContainerStyle:  styles.participantItemContainerStyle }>
                <Image source = { { uri:callerAvatarURL }} style = {styles.participantImageStyle}/>
                <View style = { isTeamsCall ? styles.participantTeamsNameSectionStyle : styles.participantNameSectionStyle }>
                    <View style = { styles.participantNameContainerStyle }>
                        <Text style = { isTeamsCall ? styles.pariticipantTeamsNameTextStyle : styles.pariticipantNameTextStyle }>{name}</Text>
                        <Text style = { isTeamsCall ? styles.pariticipantTeamsPositionTextStyle : styles.pariticipantPositionTextStyle }>Position</Text>
                    </View>
                    <Image source = { CROSS_ICON } style = {{display: 'none'}}/>
                </View>
            </View>
        );
    }
}

export default ParticipantItem;
