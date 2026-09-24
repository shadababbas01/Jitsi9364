import React, { Component } from 'react';
import { View, Image, Text, TouchableHighlight } from 'react-native';
import AudioMuteButton from '../../../toolbox/components/native/AudioMuteButton';
import VideoMuteButton from '../../../toolbox/components/native/VideoMuteButton';
import HangupButton from '../../../toolbox/components/HangupButton';
import ChatButton from '../../../../features/chat/components/native/ChatButton';
import i18next, { DEFAULT_LANGUAGE, LANGUAGES } from '../../../base/i18n/i18next';
import AudioPageTranslation from '../../../../AudioPageTranslation';
import AudioDeviceToggleButton from '../../../mobile/audio-mode/components/AudioDeviceToggleButton';
import styles, { DESKTOP_ENABLED_ICON, DESKTOP_DISABLED_ICON, ADD_CALL_ICON,
    VIDEO_CALL_DISABLED_ICON,
    AUDIO_MUTE_DISABLED_ICON,
    VIEW_ATTENDEES_ENABLED_ICON,
    VIDEO_CALL_ENABLED_ICON,
    SPEAKER_ENABLED_ICON,
    MESSAGE_ICON,
    HOLD_ENABLED_ICON,
    HOLD_DISABLED_ICON,
    SPEAKER_DISABLED_ICON,
    VIEW_ATTENDEES_DISABLED_ICON,
    END_CALL_ICON,
    S_END_CALL_ICON,
    P_END_CALL_ICON,
    DE_END_CALL_ICON,
    VI_END_CALL_ICON,
    AUDIO_MUTE_ENABLED_ICON,
    SPEAKER_TEAMS_INACTIVE_ICON,
    SPEAKER_ONE_TO_ONE_INACTIVE_ICON,
    AUDIO_MUTE_TEAMS_INACTIVE_ICON,
    AUDIO_MUTE_ONE_TO_ONE_INACTIVE_ICON,
    VIDEO_ONE_TO_ONE_INACTIVE_ICON,
    VIDEO_TEAMS_INACTIVE_ICON ,
    BLUETOOTH,
    DOT,
    NODOT} from './styles';
import { ColorPalette } from '../../../base/styles/components/styles/ColorPalette';
import HoldButton from './HoldButton';
import { NativeModules, Platform } from 'react-native';
import { translate } from '../../../base/i18n/functions';
import { connect } from 'react-redux';
import { selectAudioDevice, isSpeakerSelected } from '../../../mobile/audio-mode/functions';
import { navigate } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../../mobile/navigation/routes';
import { open as openParticipantsPane } from '../../../participants-pane/actions.native';

type Props = AbstractButtonProps & {

    /**
    * The Redux dispatch function.
    */
    dispatch: Dispatch<any>
};






// import AudioMuteButton from '../../../toolbox/components/AudioMuteButton';

/**
 *  Function which says if platform is iOS or not.
 *
 */
function isPlatformiOS(): boolean {
    return Platform.OS === 'ios';
}
const { AudioMode, OpenMelpChat } = NativeModules;

class CustomisedToolBox extends Component<Props, *> {
    state = {
        isHoldOn: false
    };

    _handleSpeakerClick = () => {
        const devices = this.props._devices || [];
        const currentDevice = devices.find(d => d.selected);
        const isCurrentSpeaker = currentDevice
            ? currentDevice.type === 'SPEAKER'
            : Boolean(this.props.speakerOn || this.props._isSpeakerSelected);

        if (isCurrentSpeaker) {
            // Currently on speaker -> switch directly to earpiece
            const earpieceDevice = devices.find(d => d.type === 'EARPIECE');
            const target = earpieceDevice?.uid || 'EARPIECE';
            selectAudioDevice(target);
            if (AudioMode?.setSpeakerOn) {
                AudioMode.setSpeakerOn(false).catch(() => {});
            }
            this.props.setSpeakerState?.(false);
        } else {
            // Currently on earpiece -> switch directly to speaker
            const speakerDevice = devices.find(d => d.type === 'SPEAKER');
            const target = speakerDevice?.uid || 'SPEAKER';
            selectAudioDevice(target);
            if (AudioMode?.setSpeakerOn) {
                AudioMode.setSpeakerOn(true).catch(() => {});
            }
            this.props.setSpeakerState?.(true);
        }
    };

    _showAttendees = () => {
        const { _participants } = this.props;
        const attendees = [];

        if (_participants?.local?.email) {
            attendees.push(_participants.local.email);
        }

        _participants?.remote?.forEach(participant => {
            if (participant?.email) {
                attendees.push(participant.email);
            }
        });

        if (OpenMelpChat?.showAttendees) {
            OpenMelpChat.showAttendees(attendees);
            return;
        }

        if (NativeModules?.NativeCallsNew?.showAttendees) {
            NativeModules.NativeCallsNew.showAttendees(attendees);
            return;
        }

        NativeModules?.NativeCallsNew?.showAttendeeeees?.();
    };

    _desktopIconClicked = () => {
        NativeModules.NativeCallsNew?.showDesktop?.();
    };

    _addToCall = () => {
        this.props.dispatch(openParticipantsPane());
        navigate(screen.conference.participants);
    };

    _chatClicked = () => {};

    _hangupClicked = () => {};

    _onMuteClick = () => {};

    setHoldState = (isHoldOn) => {
        this.setState({ isHoldOn });
        OpenMelpChat?.holdclick?.(isHoldOn);
    };

    constructor(props) {
        super(props);
        this.props.setSpeakerState?.(false);
    }

    componentDidMount() {
        AudioMode?.updateDeviceList?.();
    }
    render() {
        const toolBoxFunctionTextStyle =   this.props.isTeamsCall?styles.toolBoxFunctionTextTeamStyle:styles.toolBoxFunctionTextOneToOneStyle;
        const { setSpeakerState, speakerOn, isShowingAttendees, ismessage,setMessagestate  }= this.props;
        const { isHoldOn } = this.state;
        const { audioMuted } = this.props;
        const { newMessage } = this.props;
        const toolBoxInactiveStyle = isHoldOn ?
        this.props.isTeamsCall ?
        styles.toolBoxFunctionInactiveTeamStyle: styles.toolBoxFunctionInactiveOneToOneStyle: toolBoxFunctionTextStyle;

        const audioMuteInactiveIconSource =
        this.props.isTeamsCall ? AUDIO_MUTE_TEAMS_INACTIVE_ICON : AUDIO_MUTE_ONE_TO_ONE_INACTIVE_ICON;

        const speakerIconInactiveSource =
        this.props.isTeamsCall ? SPEAKER_TEAMS_INACTIVE_ICON : SPEAKER_ONE_TO_ONE_INACTIVE_ICON;

        const videoIconInactiveSource =
        this.props.isTeamsCall ? VIDEO_TEAMS_INACTIVE_ICON : VIDEO_ONE_TO_ONE_INACTIVE_ICON;

        const speakerOnOffMessage =
        this.props.speakerOn ? "SPEAKER ON" : "SPEAKER OFF";

    const devices = this.props._devices || [];
    const selectedDevice = devices.find(d => d.selected);

    var text = "SPEAKER OFF";
    var icon = SPEAKER_DISABLED_ICON;

    if (selectedDevice) {
        if (selectedDevice.type === 'BLUETOOTH') {
            text = 'BLUETOOTH';
            icon = BLUETOOTH;
        } else if (selectedDevice.type === 'HEADPHONES') {
            text = 'HEADPHONES';
            icon = BLUETOOTH;
        } else if (selectedDevice.type === 'SPEAKER') {
            text = 'SPEAKER ON';
            icon = SPEAKER_ENABLED_ICON;
        } else if (selectedDevice.type === 'EARPIECE') {
            text = 'SPEAKER OFF';
            icon = SPEAKER_DISABLED_ICON;
        }
    } else if (this.props.speakerOn || this.props._isSpeakerSelected) {
        text = 'SPEAKER ON';
        icon = SPEAKER_ENABLED_ICON;
    }
    OpenMelpChat?.isAudioMode?.(true);
    console.log(">>>>>>>>>>>>>>>ismessage",ismessage);
    console.log("this is in app language we sent -->", i18next.language);
    const getTranslatedText = (key) => {
        const languageCode = i18next.language || 'en';
        const translation = AudioPageTranslation[languageCode] || AudioPageTranslation.en || {};
        return translation[key] || key;
    };
    function formatString(input) {
        // Convert the string to lowercase
        let lowerCaseString = input.toLowerCase();
    
        // Remove all spaces from the string
        let formattedString = lowerCaseString.replace(/\s+/g, '');
    
        return formattedString;
    }

    let ecndCallIcon;
    if(i18next.language==='esUS'){
        ecndCallIcon= S_END_CALL_ICON;

     }
     else if(i18next.language==='ptBR'){
        ecndCallIcon= P_END_CALL_ICON;
     }else if(i18next.language==='vi'){
        ecndCallIcon= VI_END_CALL_ICON;
     }else if(i18next.language==='de'){
        ecndCallIcon= DE_END_CALL_ICON;
     }
     else{
        ecndCallIcon= END_CALL_ICON
     }
     let messageIcon;
     if(newMessage){
         messageIcon = DOT;
     }else{
         messageIcon = NODOT;
     }
     console.log('this is message icon ', messageIcon);


        return (
            <View style = { styles.toolBoxContainerStyle }>
                <View style = { styles.toolBoxSectionContainerStyle} >
                <TouchableHighlight onPress={this._desktopIconClicked} underlayColor={ColorPalette.transparent}>
                    <View style = { styles.toolBoxFunctionContainerStyle }>
                        <Image style = { styles.desktopIconStyle } source = { DESKTOP_DISABLED_ICON }/>
                        <Text style = { styles.toolBoxFunctionTextDisableDialpadStyle }>{getTranslatedText("dialpad")}</Text>
                    </View>
                    </TouchableHighlight>
                    <TouchableHighlight onPress={this._showAttendees} underlayColor={ColorPalette.transparent}>
                        <View style = { styles.toolBoxFunctionContainerStyle }>
                            <Image style = { styles.attendeesIconStyle } source = { isShowingAttendees ? VIEW_ATTENDEES_ENABLED_ICON: VIEW_ATTENDEES_ENABLED_ICON }/>
                            <Text style = { toolBoxFunctionTextStyle }>{getTranslatedText('attendees')}</Text>
                        </View>
                    </TouchableHighlight>
                   <TouchableHighlight onPress={this._addToCall} underlayColor={ColorPalette.transparent}>
                        <View style = { styles.toolBoxFunctionContainerStyle }>
                            <Image style = { styles.addCallIconStyle } source = { ADD_CALL_ICON }/>
                            <Text style = { toolBoxFunctionTextStyle }>{getTranslatedText("addcall")}</Text>
                        </View>
                    </TouchableHighlight>



                </View>
                <View style = { styles.toolBoxSectionContainerStyle} >

                        <AudioMuteButton>

                            {(isMuted, onClick) => (<TouchableHighlight disabled = {isHoldOn} onPress={onClick} underlayColor={ColorPalette.transparent}>
                                <View style = { styles.toolBoxFunctionContainerStyle }>
                                <Image source={isHoldOn ? AUDIO_MUTE_DISABLED_ICON : isMuted ? AUDIO_MUTE_ENABLED_ICON : AUDIO_MUTE_DISABLED_ICON} style={styles.muteIconStyle} />
                                <Text style={toolBoxInactiveStyle}>{getTranslatedText("mute")}</Text>
                                </View>
                            </TouchableHighlight>)
                            }
                        </AudioMuteButton>


                         <VideoMuteButton >
                            {(_isVideoMuted, _onClick ) =>(
                            <TouchableHighlight  disabled = {isHoldOn} onPress={_onClick} underlayColor={ColorPalette.transparent}>
                                <View style={styles.toolBoxFunctionContainerStyle}>
                                <Image style={styles.videoIconStyle} source={isHoldOn ? VIDEO_CALL_DISABLED_ICON : !_isVideoMuted ? VIDEO_CALL_ENABLED_ICON :  VIDEO_CALL_DISABLED_ICON} />
                                    <Text style={toolBoxInactiveStyle}>{getTranslatedText("videoCall")}</Text>
                                </View>
                            </TouchableHighlight>
                            )
                            }
                        </VideoMuteButton>
                        <AudioDeviceToggleButton>
                        {(_onClick) =>
                            (<TouchableHighlight disabled = {isHoldOn} onPress={this._handleSpeakerClick} underlayColor={ColorPalette.transparent}>
                                <View style = { styles.toolBoxFunctionContainerStyle }>
                                <Image style={styles.speakerIconStyle} source={icon} />
                                            <Text style={toolBoxInactiveStyle}>{getTranslatedText(formatString(text))}</Text>
                                    {/* <Image style = { styles.speakerIconStyle } source = {isHoldOn ? SPEAKER_DISABLED_ICON : speakerOn ? SPEAKER_ENABLED_ICON : SPEAKER_DISABLED_ICON}/>
                                    <Text style = { toolBoxInactiveStyle }>SPEAKER ON</Text> */}
                                </View>
                            </TouchableHighlight>)
                            }
                    </AudioDeviceToggleButton>
                </View>
                <View style = { styles.toolBoxSectionContainerStyle} >
                   <ChatButton setMessagestate={setMessagestate}>
                        {(_onClick) =>
                        (
                        <TouchableHighlight onPress={_onClick} underlayColor={ColorPalette.transparent}>
                            <View style = { styles.toolBoxFunctionContainerStyle }>
                                <Image style = { styles.messageIconStyle } source={ismessage ? DOT : NODOT}/>
                                <Text style = { toolBoxFunctionTextStyle }>{getTranslatedText("message")} </Text>
                            </View>
                        </TouchableHighlight>)
                        }
                    </ChatButton>


                    <HangupButton>
                        {
                            (_onClick) =>
                            (
                                <TouchableHighlight onPress={_onClick} underlayColor={ColorPalette.transparent}>
                                <View style = {styles.endCallFunctionContainerStyle}>
                                        <Image style = { styles.endIconStyle } source = { ecndCallIcon } resizeMode = 'cover'/>
                                </View>
                                </TouchableHighlight>
                            )
                        }
                    </HangupButton>

                    <HoldButton setSpeakerState = {setSpeakerState}  speakerOn={speakerOn} setHoldState = {this.setHoldState} isHoldOn= {isHoldOn}>
                        {
                            (_onClick, isHoldDisabled) =>
                        (
                        <TouchableHighlight onPress={_onClick} underlayColor={ColorPalette.transparent}>
                            <View style = { styles.toolBoxFunctionContainerStyle }>
                                <Image source = { isHoldOn ? HOLD_ENABLED_ICON : HOLD_DISABLED_ICON}
                                    style = { styles.holdIconStyle } />
                                <Text style = { toolBoxFunctionTextStyle }>{getTranslatedText("hold")}</Text>
                            </View>
                        </TouchableHighlight>
                        )
                        }
                    </HoldButton>
                </View>
            </View>
        );
    }
}

function _mapStateToProps(state) {
    return {
        _devices: state['features/mobile/audio-mode']?.devices || [],
        _isSpeakerSelected: isSpeakerSelected(state),
        _participants: state['features/base/participants']
    };
}
export default translate(connect(_mapStateToProps)(CustomisedToolBox));