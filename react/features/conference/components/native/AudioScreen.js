import React, { Component } from 'react';
import { NativeModules } from 'react-native';
import Orientation from 'react-native-orientation-locker';

const { OpenMelpChat } = NativeModules;
class AudioScreen extends Component {

    componentDidMount(){
        // Orientation.lockToPortrait();
        // if(OpenMelpChat && OpenMelpChat.isAudioMode){
        //     OpenMelpChat.isAudioMode(true);
        // }
    }

    render() {
        return this.props.children;
    }
}

export default AudioScreen;