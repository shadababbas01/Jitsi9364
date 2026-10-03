import React, { Component } from 'react';
import { View, Text } from 'react-native';
import styles from './styles';
import CallTimer from './CallTimer';
import i18next from 'i18next';
import AudioPageTranslation from '../../../../AudioPageTranslation';
import {
    getParticipants,
    getLocalParticipant,
    getParticipantCount,
    getParticipantCountRemoteOnly
} from '../../../base/participants/functions';
import { getConferenceName } from '../../../base/conference/functions';
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

        let {userPicUrl,roomName, participants, isTeamsCall, connected, otherParticipants, secsToMinString, callerName, callerDetails, connectionState: propConnectionState, participant, conferenceName} = this.props;   
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
        let participantText = isTeamsCall ? roomName || conferenceName || '' : conferenceName || '';
        if (isTeamsCall) {
            if (!participantText) {
                participantText = decodeURI(roomName || '');
            }
        } else {
            updatedcallerDetails = callerDetails || '';
            const remoteParticipants = (otherParticipants || []).filter(p => !p?.local);
            const remoteParticipant = remoteParticipants.find(p => p?.name || p?.displayName);

            // Always prefer the video call title (conferenceName) so both screens are in sync.
            // If conferenceName is not available, fallback to remote participant's name, callerName, or roomName.
            if (!participantText) {
                if (remoteParticipant) {
                    participantText = remoteParticipant.name || remoteParticipant.displayName;
                } else if (callerName) {
                    participantText = callerName;
                } else if (roomName) {
                    participantText = decodeURI(roomName);
                }
            }

            if (remoteParticipants.length > 1) {
                callerDetails = 'Conference Call';
            } else {
                callerDetails = updatedcallerDetails;
            }
        }

        NativeModules.NativeCallsNew?.updatedUserName?.(participantText);
        if (participants && participants.length > 0) {
            if (connectionState === 'Reconnecting') {
               connectionState = 'Reconnecting';
            } else {
                connectionState = 'Connected';
            }
        }
        let participantsDetails;
        if (isTeamsCall) {
            participantsDetails = getTranslatedText('callerdetail');
        } else {
            participantsDetails = callerDetails;
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
                <Text
                    adjustsFontSizeToFit = { true }
                    allowFontScaling = { false }
                    ellipsizeMode = 'tail'
                    minimumFontScale = { 0.7 }
                    numberOfLines = { 1 }
                    style = { isTeamsCall ? styles.teamTextStyle : styles.oneToOneTextStyle }>
                    { participantText }
                </Text>
                <Text style = { styles.participantTextStyle }>{participantsDetails}</Text>
                <Text
                    adjustsFontSizeToFit = { true }
                    allowFontScaling = { false }
                    minimumFontScale = { 0.75 }
                    numberOfLines = { 1 }
                    style = { isTeamsCall
                        ? [
                            styles.connectionStatusTeamsTextStyle,
                            !participantsDetails && styles.connectionStatusHiddenTextStyle
                        ]
                        : [
                            styles.connectionStatusOneToOneTextStyle,
                            !participantsDetails && styles.connectionStatusHiddenTextStyle
                        ] }>
                    { status }
                </Text>
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
    // The native call timeout uses this value as the total number of people in
    // the room, including the local participant.  Do not send the remote-only
    // count here: a call with only the local participant must be reported as 1
    // (not 0), otherwise the native side cannot distinguish it from a call
    // which has not joined yet.
    const participantsCount = getParticipantCount(state);
    const remoteParticipantsCount = getParticipantCountRemoteOnly(state);

    if (totalUser != participantsCount) {
        totalUser = participantsCount;
        NativeModules.NativeCallsNew?.totalUsers?.(participantsCount);
    }

    const localParticipant = getLocalParticipant(state);
    const _settings = state['features/base/settings'] || {};
    const _config = state['features/base/config'] || {};
    const otherParticipants = localParticipant ? participants.filter(p => p.id !== localParticipant.id) : participants;

    const callerName = _settings.callerName || _config.callerName || '';
    const callerDetails = _settings.callerDetails || _config.callerDetails || '';
    return {
        participants,
        otherParticipants,
        callerName,
        callerDetails,
        participantsCount: remoteParticipantsCount,
        conferenceName: getConferenceName(state)
    };
}

export default connect(_mapStateToProps)(CalleeDetails);
