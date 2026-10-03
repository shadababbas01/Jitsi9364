
import React, { Component } from 'react';
import { connect } from 'react-redux';
import styles from './styles';
import { View, Image, Text } from 'react-native';
export const GROUP_CALL_ICON = require('../../../../../images/team_icon.png');
export const ONE_TO_ONE_FALLBACK_ICON = require('../../../../../images/avatar.png');

class CalleeBoxView extends Component {
    constructor(props) {
        super(props);
        this.state = { imageFailed: false };
    }

    componentDidUpdate(previousProps) {
        if (previousProps.identityImage !== this.props.identityImage && this.state.imageFailed) {
            this.setState({ imageFailed: false });
        }
    }

    render() {
        const {isTeamsCall, participantsss, roomName, participantId, userPicUrl, identityImage} = this.props;
        const initials = roomName ? roomName.split(' ').filter(n=>n && n.length>0).map(n=>n[0]).join(''): '';
        let avatarImageUrl = identityImage || null;
        // if(participant!=null){
        //     avatarImageUrl = participant.avatarImageUrl;
        // }
        const filterarray = (participantsss && Array.isArray(participantsss) ? participantsss : []).filter(p => !p.local);
        if (!avatarImageUrl && !isTeamsCall) {
            for (const attendee of filterarray) {
                if (attendee.avatarURL) {
                    avatarImageUrl = attendee.avatarURL;
                    break;
                }
            }
        }
        if (this.state.imageFailed) {
            avatarImageUrl = null;
        } else if (avatarImageUrl == null) {
            avatarImageUrl = identityImage || userPicUrl;
        }
        if (isTeamsCall) {
            return (
                <View style = { styles.imageViewBoxStyle } >
                    <Image source={avatarImageUrl ? { uri: avatarImageUrl } : GROUP_CALL_ICON}
                        onError={() => this.setState({ imageFailed: true })}
                        style = { { flex: 1, width: undefined, height: undefined, borderRadius: 18, overflow: 'hidden' } }
                        resizeMode = 'stretch'/>
                </View>
            );
        } else {
            return (
                avatarImageUrl ?
                (<View style = { styles.imageViewBoxStyle } >
                    <Image source={{uri: avatarImageUrl}} onError={() => this.setState({ imageFailed: true })} style = { {flex: 1, width: undefined, height: undefined, borderRadius: 18, overflow: 'hidden'}} resizeMode = 'stretch'/>
                </View>) :
                <View style = { styles.imageViewBoxStyle } >
                    <Image source={ONE_TO_ONE_FALLBACK_ICON} style = { {flex: 1, width: undefined, height: undefined, borderRadius: 18, overflow: 'hidden'}} resizeMode = 'stretch'/>
                </View>
            ); 
        }
    }
}

function _mapStateToProps(state, ownProps) {
    const _participantId = state['features/large-video']?.participantId;
    const _settings = state['features/base/settings'] || {};
    const _config = state['features/base/config'] || {};
    return {
        participantId: _participantId,
        userPicUrl: _settings.callerAvatarURL || _config.callerAvatarURL,
        identityImage: _settings.callDisplayImage || _config.callDisplayImage,
    };
}

export default connect(_mapStateToProps)(CalleeBoxView);
