import { IConfig } from './configType';

const STATIC_CONFIG: IConfig = {
    hosts: {
        domain: 'uat.meet.melpapp.com',
        muc: 'muc.uat.meet.melpapp.com',
        authdomain: 'uat.meet.melpapp.com'
    },
    bosh: 'https://uat.meet.melpapp.com/http-bind',
    websocket: 'wss://uat.meet.melpapp.com/xmpp-websocket',
    bridgeChannel: {
        preferSctp: true
    },
    resolution: 720,
    constraints: {
        video: {
            height: { ideal: 720, max: 720, min: 180 },
            width: { ideal: 1280, max: 1280, min: 320 },
            frameRate: { max: 30 }
        }
    },
    startVideoMuted: 10,
    startWithVideoMuted: false,
    flags: {
        sourceNameSignaling: true,
        sendMultipleVideoStreams: true,
        receiveMultipleVideoStreams: true
    },
    enableNoAudioDetection: true,
    enableTalkWhileMuted: false,
    disableAP: false,
    disableAGC: false,
    audioQuality: {
        stereo: false,
        enableOpusDtx: false,
        enableAdvancedAudioSettings: false
    },
    startAudioOnly: false,
    startAudioMuted: 10,
    startWithAudioMuted: false,
    startSilent: false,
    enableOpusRed: true,
    disableAudioLevels: false,
    enableNoisyMicDetection: true,
    p2p: {
        enabled: false,
        codecPreferenceOrder: [ 'VP9', 'VP8', 'H264', 'AV1' ],
        mobileCodecPreferenceOrder: [ 'VP8', 'H264', 'VP9', 'AV1' ]
    },
    hideAddRoomButton: false,
    channelLastN: 16,
    maxFullResolutionParticipants: 1,
    etherpad_base: 'https://uat.meet.melpapp.com/etherpad/p/',
    hiddenDomain: 'recorder.uat.meet.melpapp.com',
    recordingService: {
        enabled: false,
        sharingEnabled: false
    },
    liveStreaming: {
        enabled: true,
        dataPrivacyLink: 'https://policies.google.com/privacy',
        helpLink: 'https://jitsi.org/live',
        termsLink: 'https://www.youtube.com/t/terms',
        validatorRegExpString: '^(?:[a-zA-Z0-9]{4}(?:-(?!$)|$)){4}'
    },
    localRecording: {
        disable: false,
        notifyAllParticipants: true,
        disableSelfRecording: false
    },
    analytics: {},
    enableCalendarIntegration: false,
    prejoinConfig: {
        enabled: false,
        hideDisplayName: false
    },
    welcomePage: {
        disabled: true
    },
    enableClosePage: false,
    requireDisplayName: false,
    disableProfile: false,
    roomPasswordNumberOfDigits: false,
    transcription: {
        enabled: true,
        disableClosedCaptions: false,
        translationLanguages: [
            'en', 'de', 'es', 'fr', 'pt', 'ru', 'id', 'hi', 'zh', 'ja', 'ko', 'ms', 'vi'
        ],
        translationLanguagesHead: [ 'en' ],
        useAppLanguage: true,
        preferredLanguage: 'en-US',
        disableStartForAll: false,
        autoCaptionOnRecord: true
    },
    deploymentInfo: {},
    disableDeepLinking: false,
    videoQuality: {
        codecPreferenceOrder: [ 'VP9', 'VP8', 'H264', 'AV1' ],
        mobileCodecPreferenceOrder: [ 'VP8', 'H264', 'VP9', 'AV1' ],
        enableAdaptiveMode: true,
        h264: {},
        vp8: {},
        vp9: { scalabilityModeEnabled: true },
        av1: { useSimulcast: false }
    },
    desktopSharingCodecPreferenceOrder: [ 'VP8', 'VP9', 'H264' ],
    disableReactions: false,
    disablePolls: false,
    remoteVideoMenu: {
        disabled: false,
        disableKick: false,
        disableGrantModerator: false,
        disablePrivateChat: false
    },
    e2eping: {
        enabled: false
    },
    whiteboard: {
        enabled: true,
        collabServerBaseUrl: 'https://uat.meet.melpapp.com'
    },
    testing: {
        enableCodecSelectionAPI: true
    }
};

export function getStaticConfig(): IConfig {
    return STATIC_CONFIG;
}
