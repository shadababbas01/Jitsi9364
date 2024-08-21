import React, { Component } from 'react';
import { View, Text, Image } from 'react-native';
import styles, { CALL_ICON, CALL_ONETOONE_ICON } from './styles';
import ConferenceTimer from '../ConferenceTimer';

class CallTimer extends Component {

    // intervalObj; 

    // secondsToMinutes(interval){
    //     return Math.floor(interval / 60) + ':' + ('0' + Math.floor(interval % 60)).slice(-2);
    // }

    // constructor(props){
    //     super(props);
    //     this.state = {interval: 0};
    //     this.intervalObj = setInterval(()=>{this.setState({interval:this.state.interval+1})}, 1000);
    //     this.secondsToMinutes.bind(this);
    // }


    
    
    render() {
        const {isTeamsCall, secsToMinString} = this.props;
        const callerTimeStyle = isTeamsCall?styles.callerTimeTeamContainerStyle:styles.callerTimeOneToOneContainerStyle;
        const timerTextStyle = isTeamsCall?styles.timerTextTeamStyle:styles.timerTextOneToOneStyle;
        const callIcon = isTeamsCall?CALL_ICON:CALL_ONETOONE_ICON;
        const callIconStyle = isTeamsCall? styles.callIcon: styles.callOneToOneIcon;
        if(secsToMinString>0){
        return (
            <View style = {callerTimeStyle}>
                <Image source = { callIcon } style = { callIconStyle } />
                {/* <Text style = {timerTextStyle}>{secsToMinString}</Text> */}
             <ConferenceTimer textStyle = { timerTextStyle }/>

            </View>
        );
        }else{
            return null;
        }
    }

    // componentWillUnmount() {
    //     clearInterval(this.intervalObj);
    // }
}

export default CallTimer;


// import React, { Component } from 'react';
// import { View, Text, Image } from 'react-native';
// import styles, { CALL_ICON, CALL_ONETOONE_ICON } from './styles';

// class CallTimer extends Component {
//     constructor(props) {
//         super(props);
//         this.state = {
//             elapsedTime: 0,
//         };
//     }

//     componentDidMount() {
//         this.startTime = Date.now();
//         this.timerInterval = setInterval(() => {
//             const elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
//             this.setState({ elapsedTime });
//         }, 1000);
//     }

//     componentWillUnmount() {
//         clearInterval(this.timerInterval);
//     }

//     formatTime(seconds) {
//         const minutes = Math.floor(seconds / 60);
//         const remainingSeconds = seconds % 60;
//         return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
//     }

//     render() {
//         const { isTeamsCall, secsToMinString } = this.props;
//         const { elapsedTime } = this.state;

//         const callerTimeStyle = isTeamsCall ? styles.callerTimeTeamContainerStyle : styles.callerTimeOneToOneContainerStyle;
//         const timerTextStyle = isTeamsCall ? styles.timerTextTeamStyle : styles.timerTextOneToOneStyle;
//         const callIcon = isTeamsCall ? CALL_ICON : CALL_ONETOONE_ICON;
//         const callIconStyle = isTeamsCall ? styles.callIcon : styles.callOneToOneIcon;

//         if (secsToMinString > 0) {
//             return (
//                 <View style={callerTimeStyle}>
//                     <Image source={callIcon} style={callIconStyle} />
//                     <Text style={timerTextStyle}>{this.formatTime(elapsedTime)}</Text>
//                 </View>
//             );
//         } else {
//             return null;
//         }
//     }
// }

// export default CallTimer;
