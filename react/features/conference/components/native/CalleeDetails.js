import React, { Component } from 'react';
import { View, Text } from 'react-native';
import styles from './styles';
import CallTimer from './CallTimer';
import i18next from 'i18next';
import AudioPageTranslation from '../../../../AudioPageTranslation';
import {
    getParticipants,
    getLocalParticipant,
    getParticipantCountRemoteOnly
} from '../../../base/participants/functions';
import { connect } from 'react-redux';
import CalleeBoxView from './CalleeBoxView';
import {NativeModules} from 'react-native';
const { AudioMode } = NativeModules;

var updatedcallerDetails = "", updatedConnectionStatus = "", connectionState = "", totalUser ="0", isFirstTimeAudioCall = true;

class CalleeDetails extends Component {
    componentWillUnmount() {
        updatedConnectionStatus = ""; 
        updatedcallerDetails =  "";
        connectionState = "";
        totalUser = "0";
    }
    render() {

        let {userPicUrl,roomName, participants, isTeamsCall, connected, otherParticipants, secsToMinString, callerName, callerDetails, connectionState: propConnectionState, participant} = this.props;   
        let connectionState = propConnectionState;
        if(connectionState === '' || !connectionState){
            connectionState = 'Connecting...'
        }
        const getTranslatedText = (key) => {
            const languageCode = i18next.language || 'en';
            const translation = AudioPageTranslation[languageCode] || AudioPageTranslation.en || {};
            return translation[key] || key;
        };
        if(connectionState === 'clear'){
            updatedConnectionStatus = ""; 
            updatedcallerDetails =  "";
            connectionState = "";
            totalUser = "0";
            isFirstTimeAudioCall = true;
        }
        let otherParticipant = null;
        if (!isTeamsCall && otherParticipants && otherParticipants.length === 1) {
            otherParticipant = otherParticipants[0];
        }
        let participantText = '';
        if (isTeamsCall) {
            participantText = decodeURI(roomName || '');
        } else {
            participantText = callerName || '';
            updatedcallerDetails = callerDetails || '';
            if (participants && participants.length > 1) {
                const filterarray = participants.filter(p => !p?.local);
                for (const attendee of filterarray) {
                    if (attendee?.name) {
                        participantText = attendee.name;
                        break;
                    }
                }
                if ((this.props.participantsCount - 1) === 0) {
                    participantText = participantText;
                } else {
                    participantText = participantText + " + " + (this.props.participantsCount - 1) + " " + getTranslatedText('others');
                    callerDetails = 'Conference Call';
                }
                
                NativeModules.NativeCallsNew?.updatedUserName?.(participantText);
            } else if (participants && participants.length === 1) {
                const filterarray = participants.filter(p => !p?.local);
                for (const attendee of filterarray) {
                    if (attendee?.name) {
                        participantText = attendee.name;
                        break;
                    }
                }
                callerDetails = updatedcallerDetails;
                NativeModules.NativeCallsNew?.updatedUserName?.(participantText);
            }
        }
        if (participants && participants.length > 0) {
            if (connectionState === 'Reconnecting') {
               connectionState = 'Reconnecting';
            } else {
                connectionState = 'Connected';
            }
        }
        let participantsDetails;
        if (isTeamsCall) {
            if (participants && participants.length > 0) {
                participantsDetails = `${(this.props.participantsCount || 0) + 1} ${getTranslatedText('members')}`;
            } else {
                participantsDetails = '';
            }
        } else {
            participantsDetails = callerDetails;
        }

        if (participantText && participantText.length > 25) {
            participantText = participantText.slice(0, 22) + "...";
        }
        if (connectionState === ' ') {
            connectionState = 'Connecting...';
        }

        if (connectionState === 'Connected') {
            updatedConnectionStatus = 'Connected';
        } else if (connectionState === 'Reconnecting') {
            connectionState = 'Reconnecting';
        } else if (updatedConnectionStatus === 'Connected') {
            connectionState = 'Connected';
        }
     
        let status;
        console.log('this is connection state --> ', connectionState);
        if (connectionState === 'Connected') {
            status = getTranslatedText('connected');
        } else if (connectionState === 'Reconnecting') {
            status = getTranslatedText('reconnecting');
        } else if (connectionState === 'Connecting...') {
            status = getTranslatedText('connecting');
        } else if (connectionState === 'Calling...') {
            status = getTranslatedText('calling');
        } else if (connectionState === 'Ringing...') {
            status = getTranslatedText('ringing');
        }
        return (
            <View style = {styles.calleeContainerStyle}>
                <CalleeBoxView isTeamsCall={isTeamsCall} participantsss = {participants}  roomName = {participantText} userPicUrl ={userPicUrl}/>
                <CallTimer isTeamsCall={isTeamsCall} secsToMinString = {participants?.length || 0} participant = {participant}/>
                <Text style = {isTeamsCall? styles.teamTextStyle: styles.oneToOneTextStyle }>{participantText}</Text>
                <Text style = { styles.participantTextStyle }>{participantsDetails}</Text>
                <Text style = { isTeamsCall? styles.connectionStatusTeamsTextStyle : styles.connectionStatusOneToOneTextStyle } >{status}</Text>
            </View>
        );
    }
}

function _mapStateToProps(state: Object, ownProps: Props) {
    const participantsMap = getParticipants(state);
    const participants = [];
    if (participantsMap && typeof participantsMap[Symbol.iterator] === 'function') {
        for (const [id, participant] of participantsMap) {
            participants.push(participant);
        }
    } else if (Array.isArray(participantsMap)) {
        participants.push(...participantsMap);
    }
    const participantsCount = getParticipantCountRemoteOnly(state);

    if (totalUser != participantsCount) {
        totalUser = participantsCount;
        NativeModules.NativeCallsNew?.totalUsers?.(participantsCount);
    }

    const localParticipant = getLocalParticipant(state);
    const _settings = state['features/base/settings'] || {};
    const otherParticipants = localParticipant ? participants.filter(p => p.id !== localParticipant.id) : participants;
    
    const callerName = _settings.callerName || '';
    const callerDetails = _settings.callerDetails || '';
    return {
        participants,
        otherParticipants,
        callerName,
        callerDetails,
        participantsCount
    };
}

export default connect(_mapStateToProps)(CalleeDetails);
