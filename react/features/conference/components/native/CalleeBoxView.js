
import React, { Component } from 'react';
import { connect } from 'react-redux';
import styles from './styles';
import { View, Image, Text } from 'react-native';
export const VIDEO_TEAMS_INACTIVE_ICON = require('../../../../../images/team_icon.png');

class CalleeBoxView extends Component {
    render() {
        const {isTeamsCall, participantsss, roomName, participantId, userPicUrl} = this.props;
        const initials = roomName ? roomName.split(' ').filter(n=>n && n.length>0).map(n=>n[0]).join(''): '';
        let avatarImageUrl = null;
        // if(participant!=null){
        //     avatarImageUrl = participant.avatarImageUrl;
        // }
        const filterarray =  participantsss.filter(p => !p.local)
                for (const attendee of filterarray) {
                    if(attendee.avatarURL){
                        avatarImageUrl = attendee.avatarURL;
                        break;
                    }
                 }
        if(avatarImageUrl == null){
            avatarImageUrl = userPicUrl
        }   
        if(isTeamsCall){
            return (
                userPicUrl?
                (<View style = { styles.imageViewBoxStyle } >
                    <Image source={{uri: userPicUrl}} style = { {flex: 1, width: undefined, height: undefined, borderRadius: 1, overflow: 'hidden'}} resizeMode = 'stretch'/>
                </View>):
                <View style = { styles.imageViewBoxStyle } >
                <Image source={VIDEO_TEAMS_INACTIVE_ICON} style = { {flex: 1, width: undefined, height: undefined, borderRadius: 18, overflow: 'hidden'}} resizeMode = 'stretch'/>
            </View>
            );
        }else{
        return (
            avatarImageUrl?
            (<View style = { styles.imageViewBoxStyle } >
            <Image source={{uri: avatarImageUrl}} style = { {flex: 1, width: undefined, height: undefined, borderRadius: 18, overflow: 'hidden'}} resizeMode = 'stretch'/>
        </View>):
         <View style = { styles.imageViewBoxStyle } >
         <Image source={VIDEO_TEAMS_INACTIVE_ICON} style = { {flex: 1, width: undefined, height: undefined, borderRadius: 18, overflow: 'hidden'}} resizeMode = 'stretch'/>
         </View>
         ); 
        }
    }
}

function _mapStateToProps(state, ownProps) {
    _participantId= state['features/large-video'].participantId;
     _settings = state['features/base/settings'];
    return {
        participantId: _participantId,
        userPicUrl:_settings.callerAvatarURL,
    };

}

export default connect(_mapStateToProps)(CalleeBoxView);